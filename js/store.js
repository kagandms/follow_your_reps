const STORAGE_KEY = 'progressive_overload_data';

export const MUSCLE_GROUPS = [
    'Göğüs', 'Sırt', 'Bacak', 'Omuz', 'Biceps', 'Triceps', 'Karın', 'Kardiyo', 'Diğer'
];

// Initial Data Structure
const getInitialData = () => ({
    exercises: [],
    sessions: []
});

// Generate ID
const generateId = () => Math.random().toString(36).slice(2, 11);

// Load Data
export const loadData = () => {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : getInitialData();
};

// Save Data
export const saveData = (data) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

// Store API
export const Store = {
    // --- EXERCISES ---
    getExercises() {
        return loadData().exercises;
    },

    getExercise(id) {
        return loadData().exercises.find(e => e.id === id);
    },

    addExercise(name, muscleGroup = 'Diğer') {
        const data = loadData();
        const existing = data.exercises.find(e => e.name.toLowerCase() === name.toLowerCase());
        
        if (existing) return existing;

        const newExercise = {
            id: generateId(),
            name,
            muscleGroup
        };
        data.exercises.push(newExercise);
        saveData(data);
        return newExercise;
    },

    // --- SESSIONS ---
    getSessions() {
        return loadData().sessions.sort((a, b) => new Date(b.date) - new Date(a.date));
    },

    getSession(id) {
        return loadData().sessions.find(s => s.id === id);
    },

    createSession(date = new Date().toISOString()) {
        const data = loadData();
        const newSession = {
            id: generateId(),
            date: date,
            name: '',
            entries: []
        };
        data.sessions.push(newSession);
        saveData(data);
        return newSession;
    },

    updateSession(session) {
        const data = loadData();
        const index = data.sessions.findIndex(s => s.id === session.id);
        if (index !== -1) {
            data.sessions[index] = session;
            saveData(data);
        }
    },
    
    deleteSession(sessionId) {
        const data = loadData();
        data.sessions = data.sessions.filter(s => s.id !== sessionId);
        saveData(data);
    },

    // --- ANALYTICS / PROGRESSIVE OVERLOAD ---
    getLastPerformance(exerciseId, currentSessionId = null) {
        const sessions = this.getSessions();
        for (const session of sessions) {
            if (session.id === currentSessionId) continue;
            
            const entry = session.entries.find(e => e.exerciseId === exerciseId);
            if (entry && entry.sets && entry.sets.length > 0) {
                return {
                    date: session.date,
                    sets: entry.sets
                };
            }
        }
        return null;
    },
    
    getExerciseHistory(exerciseId) {
        const sessions = this.getSessions();
        const history = [];
        
        for (const session of sessions) {
            const entry = session.entries.find(e => e.exerciseId === exerciseId);
            if (entry && entry.sets && entry.sets.length > 0) {
                history.push({
                    date: session.date,
                    sets: entry.sets
                });
            }
        }
        return history;
    },
    
    getWeeklyVolumeByMuscleGroup() {
        const sessions = this.getSessions();
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        
        const volume = {};
        MUSCLE_GROUPS.forEach(mg => volume[mg] = 0);
        
        const data = loadData();
        const exercisesMap = {};
        data.exercises.forEach(ex => exercisesMap[ex.id] = ex.muscleGroup || 'Diğer');
        
        sessions.forEach(session => {
            const sessionDate = new Date(session.date);
            if(sessionDate >= sevenDaysAgo) {
                session.entries.forEach(entry => {
                    const mg = exercisesMap[entry.exerciseId];
                    if (entry.sets) {
                        const completedSets = entry.sets.filter(s => s.completed).length;
                        if(volume[mg] !== undefined) {
                            volume[mg] += completedSets;
                        }
                    }
                });
            }
        });
        
        const filtered = {};
        Object.keys(volume).forEach(k => {
            if(volume[k] > 0) filtered[k] = volume[k];
        });
        
        return filtered;
    },

    // --- EXPORT / IMPORT ---
    exportJson() {
        return JSON.stringify(loadData(), null, 2);
    },

    importJson(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            if (!data.exercises || !data.sessions) {
                throw new Error("Invalid schema");
            }
            saveData(data);
            return true;
        } catch (e) {
            console.error("Import failed", e);
            return false;
        }
    }
};
