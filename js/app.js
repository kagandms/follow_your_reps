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

        this.setupThemeToggle();
        this.setupTimer();
        this.renderHome();
    }

    setupThemeToggle() {
        const btn = document.getElementById('theme-toggle-btn');
        const iconLight = document.getElementById('theme-icon-light');
        const iconDark = document.getElementById('theme-icon-dark');
        
        const isDark = localStorage.getItem('dark_theme') === 'true';
        if (isDark) {
            document.body.classList.add('dark-theme');
            iconLight.classList.add('hidden');
            iconDark.classList.remove('hidden');
        }
        
        btn.addEventListener('click', () => {
            document.body.classList.toggle('dark-theme');
            const darkActive = document.body.classList.contains('dark-theme');
            localStorage.setItem('dark_theme', darkActive);
            
            if (darkActive) {
                iconLight.classList.add('hidden');
                iconDark.classList.remove('hidden');
            } else {
                iconLight.classList.remove('hidden');
                iconDark.classList.add('hidden');
            }
        });
    }

    // --- ROUTING / VIEWS ---

    renderHome() {
        clearElement(this.appContent);
        const template = document.getElementById('tpl-home');
        const content = template.content.cloneNode(true);

        // Settings
        const settingsBtn = content.querySelector('#open-settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.showSettingsModal());
        }

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

        // Populate Templates
        const templatesList = content.querySelector('#home-templates-list');
        const manageTemplatesBtn = content.querySelector('#manage-templates-btn');
        const templates = Store.getTemplates();
        
        if (manageTemplatesBtn) {
            manageTemplatesBtn.addEventListener('click', () => this.showTemplateManagerModal());
        }
        
        if (templates.length === 0) {
            if (templatesList) templatesList.innerHTML = '<span style="color: var(--text-secondary); font-size: 0.9rem;">Henüz sabit gününüz yok. Yönet diyerek ekleyin.</span>';
        } else {
            templates.forEach(t => {
                const pill = Components.renderTemplatePill(t, () => {
                    this.showTemplateManagerModal();
                });
                if (templatesList) templatesList.appendChild(pill);
            });
        }

        // Populate Recent Sessions
        const listContainer = content.querySelector('#recent-workouts-list');
        const sessions = Store.getSessions();
        
        if (sessions.length === 0) {
            listContainer.innerHTML = '<p style="color: var(--text-secondary); text-align: center; margin-top: 20px;">Henüz antrenman yok. Bir tane başlatın!</p>';
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
        dateInput.value = this.currentSession.date;
        dateInput.addEventListener('change', (e) => {
            this.currentSession.date = e.target.value;
            Store.updateSession(this.currentSession);
        });
        
        const nameInput = content.querySelector('#session-name-input');
        if (nameInput) {
            nameInput.value = this.currentSession.name || '';
            nameInput.addEventListener('change', (e) => {
                this.currentSession.name = e.target.value;
                Store.updateSession(this.currentSession);
            });
        }

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
            
            const card = Components.renderExerciseCardCompact(
                entry, 
                exerciseDef, 
                // onClick opens the focus modal
                () => {
                    this.showExerciseFocusModal(entry, exerciseDef);
                }
            );
            
            // Add Delete Exercise Button
            const delExBtn = document.createElement('button');
            delExBtn.className = 'icon-btn danger';
            delExBtn.textContent = 'Egzersizi Kaldır';
            delExBtn.style.width = '100%';
            delExBtn.style.marginTop = '8px';
            delExBtn.onclick = (e) => {
                e.stopPropagation(); // Prevent clicking the card
                if(confirm('Bu egzersizi seanstan kaldırmak istediğinize emin misiniz?')) {
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
            this.timerDisplay.textContent = 'BİTTİ';
            if('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
            return;
        }
        
        const m = Math.floor(remaining / 60);
        const s = remaining % 60;
        this.timerDisplay.textContent = `${m}:${s.toString().padStart(2, '0')}`;
    }

    // --- MODALS ---

    showTemplateManagerModal() {
        const template = document.getElementById('tpl-template-manager');
        const content = template.content.cloneNode(true);
        const modal = content.querySelector('.modal-view');
        
        const closeBtn = modal.querySelector('.close-modal-btn');
        closeBtn.onclick = () => {
            document.body.removeChild(modal);
            this.renderHome(); // refresh home to show new templates
        };
        
        const nameInput = modal.querySelector('#new-template-name');
        const createBtn = modal.querySelector('#create-template-btn');
        const listContainer = modal.querySelector('#template-list-container');
        
        const renderList = () => {
            clearElement(listContainer);
            const templates = Store.getTemplates();
            if (templates.length === 0) {
                listContainer.innerHTML = '<p style="color: var(--text-secondary); text-align: center; margin-top: 20px;">Henüz sabit gün şablonu oluşturmadınız.</p>';
            } else {
                templates.forEach(t => {
                    const item = Components.renderTemplateListItem(
                        t,
                        () => this.showTemplateEditModal(t, () => renderList()),
                        () => this.showTemplateEditModal(t, () => renderList()),
                        (id) => {
                            Store.deleteTemplate(id);
                            renderList();
                        }
                    );
                    listContainer.appendChild(item);
                });
            }
        };
        
        createBtn.onclick = () => {
            const val = nameInput.value.trim();
            if (val) {
                const newTpl = Store.saveTemplate(val, []);
                nameInput.value = '';
                this.showTemplateEditModal(newTpl, () => renderList());
            }
        };
        
        renderList();
        document.body.appendChild(modal);
    }

    showTemplateEditModal(templateObj, onSaved) {
        const template = document.getElementById('tpl-template-edit');
        const content = template.content.cloneNode(true);
        const modal = content.querySelector('.modal-view');
        
        modal.querySelector('#template-edit-title').textContent = `${templateObj.name} Düzenle`;
        
        const closeBtn = modal.querySelector('.close-modal-btn');
        closeBtn.onclick = () => document.body.removeChild(modal);
        
        const searchInput = modal.querySelector('#template-exercise-search');
        const listContainer = modal.querySelector('#template-exercise-list');
        const saveBtn = modal.querySelector('#save-template-exercises-btn');
        
        let selectedIds = [...(templateObj.exerciseIds || [])];
        let allExercises = Store.getExercises();
        
        const createBtn = modal.querySelector('#template-create-new-exercise-btn');
        const muscleSelect = modal.querySelector('#template-new-exercise-muscle');
        
        MUSCLE_GROUPS.forEach(mg => {
            const opt = document.createElement('option');
            opt.value = mg;
            opt.textContent = mg;
            muscleSelect.appendChild(opt);
        });
        
        const renderList = (filter = '') => {
            clearElement(listContainer);
            const filtered = allExercises.filter(e => e.name.toLowerCase().includes(filter.toLowerCase()));
            
            filtered.forEach(ex => {
                const item = document.createElement('div');
                item.className = 'list-item';
                item.style.cursor = 'pointer';
                
                const titleDiv = document.createElement('div');
                titleDiv.className = 'list-item-title';
                titleDiv.textContent = ex.name;
                
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.checked = selectedIds.includes(ex.id);
                cb.style.marginRight = '12px';
                cb.style.transform = 'scale(1.3)';
                
                item.onclick = () => {
                    cb.checked = !cb.checked;
                    if (cb.checked) {
                        if (!selectedIds.includes(ex.id)) selectedIds.push(ex.id);
                    } else {
                        selectedIds = selectedIds.filter(id => id !== ex.id);
                    }
                };
                
                const wrapper = document.createElement('div');
                wrapper.style.display = 'flex';
                wrapper.style.alignItems = 'center';
                wrapper.appendChild(cb);
                wrapper.appendChild(titleDiv);
                
                item.appendChild(wrapper);
                listContainer.appendChild(item);
            });
            
            if (filter.length > 0 && !filtered.find(e => e.name.toLowerCase() === filter.toLowerCase())) {
                createBtn.style.display = 'block';
                muscleSelect.style.display = 'block';
            } else {
                createBtn.style.display = 'none';
                muscleSelect.style.display = 'none';
            }
        };
        
        createBtn.onclick = () => {
            const name = searchInput.value.trim();
            const muscle = muscleSelect.value;
            if (name) {
                const newEx = Store.addExercise(name, muscle);
                selectedIds.push(newEx.id);
                searchInput.value = '';
                allExercises = Store.getExercises();
                renderList();
            }
        };
        
        searchInput.addEventListener('input', (e) => renderList(e.target.value));
        
        saveBtn.onclick = () => {
            Store.updateTemplate(templateObj.id, templateObj.name, selectedIds);
            document.body.removeChild(modal);
            if (onSaved) onSaved();
        };
        
        renderList();
        document.body.appendChild(modal);
    }

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
        
        // Templates Area
        const templatesArea = modal.querySelector('#exercise-selection-templates-area');
        const templatesList = modal.querySelector('#exercise-selection-templates-list');
        const templates = Store.getTemplates();
        
        if (templatesArea && templatesList && templates.length > 0) {
            templatesArea.style.display = 'block';
            templates.forEach(t => {
                const pill = Components.renderTemplatePill(t, () => {
                    if (t.exerciseIds && t.exerciseIds.length > 0) {
                        t.exerciseIds.forEach(exId => {
                            this.addExerciseToSession(exId, false); 
                        });
                        this.renderSessionExercises();
                        document.body.removeChild(modal);
                    } else {
                        alert('Bu şablonda egzersiz bulunmuyor.');
                    }
                });
                templatesList.appendChild(pill);
            });
        }
        
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
                
                // Secure creation (textContent instead of innerHTML)
                const titleDiv = document.createElement('div');
                titleDiv.className = 'list-item-title';
                titleDiv.textContent = ex.name;
                
                const subtitleDiv = document.createElement('div');
                subtitleDiv.className = 'list-item-subtitle';
                subtitleDiv.textContent = ex.muscleGroup || 'Diğer';
                
                item.appendChild(titleDiv);
                item.appendChild(subtitleDiv);
                
                item.onclick = () => {
                    this.addExerciseToSession(ex.id);
                    document.body.removeChild(modal);
                };
                listContainer.appendChild(item);
            });

            if (filter.length > 0 && !filtered.find(e => e.name.toLowerCase() === filter.toLowerCase())) {
                createBtn.style.display = 'block';
                muscleSelect.style.display = 'block';
                createBtn.textContent = `"${filter}" Oluştur`;
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
        
        modal.querySelector('#history-exercise-name').textContent = `${exerciseDef.name} Geçmişi`;
        
        const closeBtn = modal.querySelector('.close-modal-btn');
        closeBtn.onclick = () => document.body.removeChild(modal);
        
        const container = modal.querySelector('#exercise-history-list');
        const history = Store.getExerciseHistory(exerciseDef.id);
        
        Components.renderExerciseHistoryTable(history, container);
        
        document.body.appendChild(modal);
    }

    addExerciseToSession(exerciseId, openFocus = true) {
        if (!this.currentSession) return;
        
        // Default 1 empty set
        let initialSets = [
            { weight: 0, reps: 0, completed: false }
        ];
        
        this.currentSession.entries.push({
            exerciseId: exerciseId,
            sets: initialSets
        });
        
        Store.updateSession(this.currentSession);
        this.renderSessionExercises();
        
        if (openFocus) {
            // Open the focus modal immediately for the new exercise
            const entryRef = this.currentSession.entries[this.currentSession.entries.length - 1];
            const exerciseDef = Store.getExercise(exerciseId);
            this.showExerciseFocusModal(entryRef, exerciseDef);
        }
    }

    // --- NEW MODALS ---
    
    showExerciseFocusModal(entry, exerciseDef) {
        const template = document.getElementById('tpl-exercise-focus');
        const content = template.content.cloneNode(true);
        const modal = content.querySelector('.modal-view');
        
        modal.querySelector('#focus-exercise-name').textContent = exerciseDef.name;
        
        const closeBtn = modal.querySelector('.close-modal-btn');
        closeBtn.onclick = () => {
            document.body.removeChild(modal);
            this.renderSessionExercises(); // Refresh the compact view
        };
        
        const container = modal.querySelector('#focus-sets-container');
        const prevPerformance = Store.getLastPerformance(exerciseDef.id, this.currentSession.id);
        
        // Clone state for local editing
        let localSets = JSON.parse(JSON.stringify(entry.sets));
        
        const renderSets = () => {
            clearElement(container);
            
            // Table Header
            const thead = document.createElement('div');
            thead.style.display = 'grid';
            thead.style.gridTemplateColumns = '32px 1fr 1fr 40px 40px';
            thead.style.gap = '8px';
            thead.style.marginBottom = '8px';
            thead.style.color = 'var(--text-secondary)';
            thead.style.fontSize = '0.8rem';
            thead.style.textAlign = 'center';
            thead.style.fontWeight = '600';
            
            thead.innerHTML = `
                <div>Set</div>
                <div>kg</div>
                <div>Tekrar</div>
                <div><svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
                <div><svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></div>
            `;
            container.appendChild(thead);
            
            localSets.forEach((set, index) => {
                let prevSet = null;
                if (prevPerformance && prevPerformance.sets && prevPerformance.sets[index]) {
                    prevSet = prevPerformance.sets[index];
                }
                
                const row = Components.renderSetRow(
                    set, 
                    index + 1, 
                    prevSet, 
                    // onUpdate
                    (setIndex, field, value) => {
                        localSets[setIndex][field] = value;
                    },
                    // onToggle
                    (setIndex, isCompleted) => {
                        localSets[setIndex].completed = isCompleted;
                        if (isCompleted) {
                            this.timerWidget.classList.remove('hidden');
                        }
                    },
                    // onDelete
                    (setIndex) => {
                        localSets.splice(setIndex, 1);
                        renderSets();
                    }
                );
                container.appendChild(row);
            });
        };
        
        renderSets();
        
        // Add Set Button
        const addBtn = modal.querySelector('#focus-add-set-btn');
        addBtn.onclick = () => {
            let defaultWeight = 0;
            let defaultReps = 0;
            const currentSetCount = localSets.length;
            
            if (currentSetCount > 0) {
                const last = localSets[currentSetCount - 1];
                defaultWeight = last.weight;
                defaultReps = last.reps;
            }
            
            localSets.push({ weight: defaultWeight, reps: defaultReps, completed: false });
            renderSets();
        };
        
        // Save Button
        const saveBtn = modal.querySelector('#focus-save-btn');
        if (saveBtn) {
            saveBtn.onclick = () => {
                entry.sets = localSets;
                Store.updateSession(this.currentSession);
                document.body.removeChild(modal);
                this.renderSessionExercises();
            };
        }
        
        // Show History Button
        const historyBtn = modal.querySelector('#focus-show-history-btn');
        historyBtn.onclick = () => {
            this.showExerciseHistoryModal(exerciseDef);
        };
        
        document.body.appendChild(modal);
    }
    
    showSettingsModal() {
        const template = document.getElementById('tpl-settings');
        const content = template.content.cloneNode(true);
        const modal = content.querySelector('.modal-view');
        
        const closeBtn = modal.querySelector('.close-modal-btn');
        closeBtn.onclick = () => document.body.removeChild(modal);
        
        const exportBtn = modal.querySelector('#export-data-btn');
        exportBtn.onclick = () => {
            const data = Store.exportJson();
            const blob = new Blob([data], {type: 'application/json'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `workout_data_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
        };
        
        const importInput = modal.querySelector('#import-data-btn');
        importInput.onchange = (e) => {
            if(e.target.files.length === 0) return;
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (ev) => {
                const success = Store.importJson(ev.target.result);
                if(success) {
                    alert('Veriler başarıyla içe aktarıldı!');
                    document.body.removeChild(modal);
                    this.renderHome();
                } else {
                    alert('İçe aktarma başarısız. Formatı kontrol edin.');
                }
            };
            reader.readAsText(file);
        };
        
        // Force Update App (Clear SW cache)
        const updateBtn = modal.querySelector('#force-update-btn');
        if (updateBtn) {
            updateBtn.onclick = () => {
                if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.getRegistrations().then((registrations) => {
                        for (let registration of registrations) {
                            registration.unregister();
                        }
                        if ('caches' in window) {
                            caches.keys().then((names) => {
                                for (let name of names) caches.delete(name);
                            }).then(() => window.location.reload(true));
                        } else {
                            window.location.reload(true);
                        }
                    });
                } else {
                    window.location.reload(true);
                }
            };
        }

        // Bind Install App
        const installBtn = modal.querySelector('#install-app-btn');
        if (installBtn) {
            const checkInstall = () => {
                if (window.deferredPrompt) {
                    installBtn.style.display = 'block';
                }
            };
            checkInstall();
            window.addEventListener('canInstallApp', checkInstall);
            
            installBtn.onclick = async () => {
                if (window.deferredPrompt) {
                    window.deferredPrompt.prompt();
                    const { outcome } = await window.deferredPrompt.userChoice;
                    if (outcome === 'accepted') {
                        installBtn.style.display = 'none';
                    }
                    window.deferredPrompt = null;
                }
            };
        }
        
        document.body.appendChild(modal);
    }
}

// Bootstrap
window.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});

// PWA Installation Logic
window.deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later.
    window.deferredPrompt = e;
    // Notify the app that it can show the install button
    window.dispatchEvent(new CustomEvent('canInstallApp'));
});
