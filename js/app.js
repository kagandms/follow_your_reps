import { Store, MUSCLE_GROUPS } from './store.js';
import { Components } from './components.js';
import { clearElement, debounce } from './utils.js';

class App {
    constructor() {
        this.appContent = document.getElementById('app-content');
        this.currentSession = null;
        
        // Timer State
        this.timerInterval = null;
        this.timerEndTime = null;
        this.timerWidget = document.getElementById('rest-timer-widget');
        this.timerDisplay = document.getElementById('timer-time');
        
        this.init();
    }

    init() {
        // Setup top nav
        document.getElementById('nav-history-btn').addEventListener('click', () => {
            this.renderHome();
        });

        this.setupTimer();
        this.renderHome();
    }

    // --- ROUTING / VIEWS ---

    renderHome() {
        clearElement(this.appContent);
        const template = document.getElementById('tpl-home');
        const content = template.content.cloneNode(true);

        // Bind Start Session
        const startBtn = content.querySelector('#start-session-btn');
        startBtn.addEventListener('click', () => {
            this.startNewSession();
        });
        
        // Populate Volume Stats
        const volumeSection = content.querySelector('#volume-summary-section');
        const volumeContainer = content.querySelector('#volume-stats-container');
        const weeklyVolume = Store.getWeeklyVolumeByMuscleGroup();
        
        if(Object.keys(weeklyVolume).length > 0) {
            volumeSection.classList.remove('hidden');
            Components.renderVolumeStats(weeklyVolume, volumeContainer);
        }

        // Populate Recent Sessions
        const listContainer = content.querySelector('#recent-workouts-list');
        const sessions = Store.getSessions();
        
        if (sessions.length === 0) {
            listContainer.innerHTML = '<p style="color: var(--text-secondary); text-align: center; margin-top: 20px;">No workouts yet. Start one!</p>';
        } else {
            sessions.forEach(session => {
                const item = Components.renderSessionListItem(
                    session, 
                    // onClick
                    () => this.resumeSession(session),
                    // onDelete
                    (id) => {
                        Store.deleteSession(id);
                        this.renderHome(); // Refresh
                    }
                );
                listContainer.appendChild(item);
            });
            
            // Add Export Data button at the bottom
            const exportBtn = document.createElement('button');
            exportBtn.className = 'btn outline-btn large-btn';
            exportBtn.style.marginTop = '20px';
            exportBtn.textContent = 'Export / Import Data';
            exportBtn.onclick = () => this.showDataManagement();
            listContainer.appendChild(exportBtn);
        }

        this.appContent.appendChild(content);
    }

    startNewSession() {
        this.currentSession = Store.createSession();
        this.renderSession(this.currentSession);
    }

    resumeSession(session) {
        this.currentSession = session;
        this.renderSession(this.currentSession);
    }

    renderSession(session) {
        clearElement(this.appContent);
        const template = document.getElementById('tpl-workout-session');
        const content = template.content.cloneNode(true);

        // Date input
        const dateInput = content.querySelector('#session-date');
        const d = new Date(session.date);
        dateInput.value = d.toISOString().split('T')[0];
        dateInput.addEventListener('change', (e) => {
            session.date = new Date(e.target.value).toISOString();
            Store.updateSession(session);
        });

        // Finish button
        content.querySelector('#finish-session-btn').addEventListener('click', () => {
            Store.updateSession(session);
            this.currentSession = null;
            this.renderHome();
        });

        // Add Exercise button
        content.querySelector('#add-exercise-btn').addEventListener('click', () => {
            this.showExerciseSelectionModal();
        });

        this.appContent.appendChild(content);
        
        // Render existing exercises in session
        this.renderSessionExercises();
    }

    renderSessionExercises() {
        if (!this.currentSession) return;
        
        const container = document.getElementById('session-exercises');
        if (!container) return;
        
        clearElement(container);

        this.currentSession.entries.forEach((entry, entryIndex) => {
            const exerciseDef = Store.getExercise(entry.exerciseId);
            const prevPerformance = Store.getLastPerformance(entry.exerciseId, this.currentSession.id);
            
            const card = Components.renderExerciseCard(
                entry, 
                exerciseDef, 
                prevPerformance,
                // onAddSet
                () => {
                    let defaultWeight = 0;
                    let defaultReps = 0;
                    if (entry.sets.length > 0) {
                        const last = entry.sets[entry.sets.length - 1];
                        defaultWeight = last.weight;
                        defaultReps = last.reps;
                    }
                    entry.sets.push({ weight: defaultWeight, reps: defaultReps, completed: false });
                    Store.updateSession(this.currentSession);
                    this.renderSessionExercises(); 
                },
                // onUpdateSet
                (setIndex, field, value) => {
                    entry.sets[setIndex][field] = value;
                    Store.updateSession(this.currentSession);
                },
                // onToggleComplete
                (setIndex, isCompleted) => {
                    entry.sets[setIndex].completed = isCompleted;
                    Store.updateSession(this.currentSession);
                    // Start timer if set is completed
                    if (isCompleted) {
                        // Default to 1:30 (90s) timer when a set is completed
                        // We could make this configurable, but let's default to a smart value or just show the widget
                        this.timerWidget.classList.remove('hidden');
                    }
                },
                // onShowHistory
                () => {
                    this.showExerciseHistoryModal(exerciseDef);
                }
            );
            
            // Add Delete Exercise Button
            const delExBtn = document.createElement('button');
            delExBtn.className = 'icon-btn danger';
            delExBtn.innerHTML = 'Remove Exercise';
            delExBtn.style.width = '100%';
            delExBtn.style.marginTop = '8px';
            delExBtn.onclick = () => {
                if(confirm('Remove this exercise from the session?')) {
                    this.currentSession.entries.splice(entryIndex, 1);
                    Store.updateSession(this.currentSession);
                    this.renderSessionExercises();
                }
            };
            card.appendChild(delExBtn);
            
            container.appendChild(card);
        });
    }

    // --- TIMER LOGIC ---
    setupTimer() {
        const btns = this.timerWidget.querySelectorAll('.timer-btn:not(.stop)');
        btns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const seconds = parseInt(e.target.dataset.time, 10);
                this.startTimer(seconds);
            });
        });
        
        document.getElementById('timer-stop-btn').addEventListener('click', () => {
            this.stopTimer();
            this.timerWidget.classList.add('hidden');
        });
    }
    
    startTimer(seconds) {
        this.stopTimer();
        this.timerEndTime = Date.now() + (seconds * 1000);
        this.updateTimerDisplay();
        this.timerInterval = setInterval(() => this.updateTimerDisplay(), 1000);
    }
    
    stopTimer() {
        if(this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = null;
        this.timerDisplay.textContent = '00:00';
    }
    
    updateTimerDisplay() {
        if(!this.timerEndTime) return;
        
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((this.timerEndTime - now) / 1000));
        
        if (remaining <= 0) {
            this.stopTimer();
            this.timerDisplay.textContent = 'DONE';
            // Vibrate if supported
            if('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
            return;
        }
        
        const m = Math.floor(remaining / 60);
        const s = remaining % 60;
        this.timerDisplay.textContent = `${m}:${s.toString().padStart(2, '0')}`;
    }

    // --- MODALS ---

    showExerciseSelectionModal() {
        const template = document.getElementById('tpl-exercise-selection');
        const content = template.content.cloneNode(true);
        const modal = content.querySelector('.modal-view');
        
        const closeBtn = modal.querySelector('.close-modal-btn');
        closeBtn.onclick = () => document.body.removeChild(modal);
        
        const searchInput = modal.querySelector('#exercise-search');
        const listContainer = modal.querySelector('#exercise-list');
        const createBtn = modal.querySelector('#create-new-exercise-btn');
        const muscleSelect = modal.querySelector('#new-exercise-muscle');
        
        // Populate muscle dropdown
        MUSCLE_GROUPS.forEach(mg => {
            const opt = document.createElement('option');
            opt.value = mg;
            opt.textContent = mg;
            muscleSelect.appendChild(opt);
        });

        const allExercises = Store.getExercises();

        const renderList = (filter = '') => {
            clearElement(listContainer);
            const filtered = allExercises.filter(e => e.name.toLowerCase().includes(filter.toLowerCase()));
            
            filtered.forEach(ex => {
                const item = document.createElement('div');
                item.className = 'list-item';
                item.innerHTML = `<div class="list-item-title">${ex.name}</div>
                                  <div class="list-item-subtitle">${ex.muscleGroup || 'Other'}</div>`;
                item.onclick = () => {
                    this.addExerciseToSession(ex.id);
                    document.body.removeChild(modal);
                };
                listContainer.appendChild(item);
            });

            if (filter.length > 0 && !filtered.find(e => e.name.toLowerCase() === filter.toLowerCase())) {
                createBtn.style.display = 'block';
                muscleSelect.style.display = 'block';
                createBtn.textContent = `Create "${filter}"`;
                createBtn.onclick = () => {
                    const selectedMuscle = muscleSelect.value;
                    const newEx = Store.addExercise(filter, selectedMuscle);
                    this.addExerciseToSession(newEx.id);
                    document.body.removeChild(modal);
                };
            } else {
                createBtn.style.display = 'none';
                muscleSelect.style.display = 'none';
            }
        };

        searchInput.addEventListener('input', debounce((e) => {
            renderList(e.target.value);
        }, 150));

        renderList();
        
        document.body.appendChild(modal);
        searchInput.focus();
    }
    
    showExerciseHistoryModal(exerciseDef) {
        const template = document.getElementById('tpl-exercise-history');
        const content = template.content.cloneNode(true);
        const modal = content.querySelector('.modal-view');
        
        modal.querySelector('#history-exercise-name').textContent = `${exerciseDef.name} History`;
        
        const closeBtn = modal.querySelector('.close-modal-btn');
        closeBtn.onclick = () => document.body.removeChild(modal);
        
        const container = modal.querySelector('#exercise-history-list');
        const history = Store.getExerciseHistory(exerciseDef.id);
        
        Components.renderExerciseHistoryTable(history, container);
        
        document.body.appendChild(modal);
    }

    addExerciseToSession(exerciseId) {
        if (!this.currentSession) return;
        
        // Add default entry with 1 empty set
        this.currentSession.entries.push({
            exerciseId: exerciseId,
            sets: [{ weight: 0, reps: 0, completed: false }]
        });
        
        Store.updateSession(this.currentSession);
        this.renderSessionExercises();
    }

    // --- DATA MANAGEMENT ---
    
    showDataManagement() {
        clearElement(this.appContent);
        const container = document.createElement('div');
        container.className = 'view';
        container.style.padding = '20px';
        
        const title = document.createElement('h2');
        title.textContent = 'Data Management';
        
        const warning = document.createElement('p');
        warning.style.color = 'var(--text-secondary)';
        warning.style.marginBottom = '20px';
        warning.textContent = 'Your data is saved locally on this device. Export it to back it up or move it to another device.';
        
        const exportBtn = document.createElement('button');
        exportBtn.className = 'btn primary-btn large-btn';
        exportBtn.textContent = 'Export Data (JSON)';
        exportBtn.onclick = () => {
            const data = Store.exportJson();
            const blob = new Blob([data], {type: 'application/json'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `workout_data_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
        };
        
        const importLabel = document.createElement('h3');
        importLabel.textContent = 'Import Data';
        importLabel.style.marginTop = '30px';
        importLabel.style.marginBottom = '10px';
        
        const importInput = document.createElement('input');
        importInput.type = 'file';
        importInput.accept = '.json';
        importInput.style.marginBottom = '10px';
        
        const importBtn = document.createElement('button');
        importBtn.className = 'btn outline-btn large-btn';
        importBtn.textContent = 'Import Data';
        importBtn.onclick = () => {
            if(importInput.files.length === 0) return alert('Select a file first');
            const file = importInput.files[0];
            const reader = new FileReader();
            reader.onload = (e) => {
                const success = Store.importJson(e.target.result);
                if(success) {
                    alert('Data imported successfully!');
                    this.renderHome();
                } else {
                    alert('Failed to import data. Invalid format.');
                }
            };
            reader.readAsText(file);
        };
        
        container.appendChild(title);
        container.appendChild(warning);
        container.appendChild(exportBtn);
        container.appendChild(importLabel);
        container.appendChild(importInput);
        container.appendChild(importBtn);
        
        this.appContent.appendChild(container);
    }
}

// Bootstrap
window.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
