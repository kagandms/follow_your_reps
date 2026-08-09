import { Store } from './store.js';

export const Components = {
    renderExerciseCard(exerciseEntry, exerciseDef, previousPerformance, onAddSet, onUpdateSet, onToggleComplete, onShowHistory) {
        const card = document.createElement('div');
        card.className = 'exercise-card';
        card.dataset.id = exerciseDef.id;

        // Header
        const header = document.createElement('div');
        header.className = 'exercise-header';
        
        const title = document.createElement('div');
        title.className = 'exercise-name';
        title.textContent = exerciseDef.name;
        // Clicking title shows history
        title.onclick = onShowHistory;

        header.appendChild(title);
        card.appendChild(header);

        // Sets Table
        const table = document.createElement('div');
        table.className = 'sets-table';
        
        const thead = document.createElement('div');
        thead.style.display = 'grid';
        thead.style.gridTemplateColumns = '32px 1fr 1fr 40px';
        thead.style.gap = '8px';
        thead.style.marginBottom = '8px';
        thead.style.color = 'var(--text-secondary)';
        thead.style.fontSize = '0.8rem';
        thead.style.textAlign = 'center';
        thead.style.fontWeight = '600';
        
        // Removed SVG tick, just text for clarity, or keep it
        thead.innerHTML = `
            <div>Set</div>
            <div>kg</div>
            <div>Tekrar</div>
            <div><svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
        `;
        table.appendChild(thead);

        // Render existing sets
        exerciseEntry.sets.forEach((set, index) => {
            // Find corresponding previous set if exists
            let prevSet = null;
            if (previousPerformance && previousPerformance.sets && previousPerformance.sets[index]) {
                prevSet = previousPerformance.sets[index];
            }
            
            const row = this.renderSetRow(set, index + 1, prevSet, onUpdateSet, onToggleComplete);
            table.appendChild(row);
        });

        card.appendChild(table);

        // Add Set Button
        const addBtn = document.createElement('button');
        addBtn.className = 'add-set-btn';
        addBtn.textContent = '+ Set Ekle';
        addBtn.onclick = onAddSet;
        card.appendChild(addBtn);

        return card;
    },

    renderSetRow(set, setNumber, prevSet, onUpdate, onToggle) {
        const rowWrapper = document.createElement('div');
        rowWrapper.style.display = 'flex';
        rowWrapper.style.flexDirection = 'column';
        rowWrapper.style.borderBottom = '1px solid var(--border-color)';
        rowWrapper.style.padding = 'var(--spacing-sm) 0';

        const row = document.createElement('div');
        row.style.display = 'grid';
        row.style.gridTemplateColumns = '32px 1fr 1fr 40px';
        row.style.gap = 'var(--spacing-sm)';
        row.style.alignItems = 'center';

        // Set Number
        const num = document.createElement('div');
        num.className = 'set-number';
        num.textContent = setNumber;
        row.appendChild(num);

        // Weight Input Group
        const weightGroup = this.createStepperInput('weight', set.weight, (val) => {
            onUpdate(setNumber - 1, 'weight', val);
        }, 2.5);
        row.appendChild(weightGroup);

        // Reps Input Group
        const repsGroup = this.createStepperInput('reps', set.reps, (val) => {
            onUpdate(setNumber - 1, 'reps', val);
        }, 1);
        row.appendChild(repsGroup);

        // Complete Checkbox 
        const checkBtn = document.createElement('button');
        checkBtn.className = `set-check-btn ${set.completed ? 'completed' : ''}`;
        checkBtn.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="3" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        checkBtn.onclick = () => {
            checkBtn.classList.toggle('completed');
            onToggle(setNumber - 1, checkBtn.classList.contains('completed'));
        };
        row.appendChild(checkBtn);
        
        rowWrapper.appendChild(row);

        // Show Previous Performance under the row if exists
        if (prevSet) {
            const prevLabel = document.createElement('div');
            prevLabel.style.fontSize = '0.75rem';
            prevLabel.style.color = 'var(--text-secondary)';
            prevLabel.style.marginTop = '4px';
            prevLabel.style.textAlign = 'center';
            prevLabel.style.paddingLeft = '32px'; // align with inputs
            prevLabel.textContent = `Önceki: ${prevSet.weight}kg x ${prevSet.reps}`;
            rowWrapper.appendChild(prevLabel);
        }

        return rowWrapper;
    },

    createStepperInput(type, value, onChange, step) {
        const group = document.createElement('div');
        group.className = 'set-input-group';

        const minusBtn = document.createElement('button');
        minusBtn.className = 'icon-btn';
        minusBtn.textContent = '-';
        minusBtn.onclick = () => {
            const input = group.querySelector('input');
            let val = parseFloat(input.value) || 0;
            val = Math.max(0, val - step);
            // Fix floating point issues
            val = Math.round(val * 100) / 100;
            input.value = val;
            onChange(val);
        };

        const input = document.createElement('input');
        input.type = 'number';
        input.value = value || '';
        input.inputMode = 'decimal';
        input.onchange = (e) => onChange(parseFloat(e.target.value) || 0);

        const plusBtn = document.createElement('button');
        plusBtn.className = 'icon-btn';
        plusBtn.textContent = '+';
        plusBtn.onclick = () => {
            const input = group.querySelector('input');
            let val = parseFloat(input.value) || 0;
            val += step;
            val = Math.round(val * 100) / 100;
            input.value = val;
            onChange(val);
        };

        group.appendChild(minusBtn);
        group.appendChild(input);
        group.appendChild(plusBtn);

        return group;
    },

    renderSessionListItem(session, onClick, onDelete) {
        const item = document.createElement('div');
        item.className = 'list-item';
        
        const contentDiv = document.createElement('div');
        contentDiv.style.flex = '1';
        
        const title = document.createElement('div');
        title.className = 'list-item-title';
        
        const date = new Date(session.date);
        title.textContent = new Intl.DateTimeFormat('tr-TR', { 
            weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
        }).format(date);
        
        const subtitle = document.createElement('div');
        subtitle.className = 'list-item-subtitle';
        const exCount = session.entries ? session.entries.length : 0;
        let setsCount = 0;
        if(session.entries) {
            session.entries.forEach(e => setsCount += (e.sets ? e.sets.length : 0));
        }
        subtitle.textContent = `${exCount} egzersiz, ${setsCount} set`;

        contentDiv.appendChild(title);
        contentDiv.appendChild(subtitle);
        contentDiv.onclick = onClick;
        
        item.appendChild(contentDiv);
        
        // Delete button
        const delBtn = document.createElement('button');
        delBtn.className = 'icon-btn danger delete-session-btn';
        delBtn.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
        delBtn.onclick = (e) => {
            e.stopPropagation();
            if(confirm('Bu antrenmanı silmek istediğinize emin misiniz?')) {
                onDelete(session.id);
            }
        };
        item.appendChild(delBtn);
        
        return item;
    },

    renderVolumeStats(stats, container) {
        container.innerHTML = '';
        Object.entries(stats).forEach(([muscle, count]) => {
            const card = document.createElement('div');
            card.className = 'volume-card';
            
            const countDiv = document.createElement('div');
            countDiv.className = 'sets';
            countDiv.textContent = count;
            
            const muscleDiv = document.createElement('div');
            muscleDiv.className = 'muscle';
            muscleDiv.textContent = muscle;
            
            card.appendChild(countDiv);
            card.appendChild(muscleDiv);
            container.appendChild(card);
        });
    },
    
    renderExerciseHistoryTable(history, container) {
        container.innerHTML = '';
        if (history.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; margin-top: 20px;">Henüz geçmiş bulunmuyor.</p>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'history-table';
        
        history.forEach(session => {
            // Header for date
            const dateRow = document.createElement('tr');
            const dateTd = document.createElement('td');
            dateTd.colSpan = 3;
            dateTd.className = 'history-date-header';
            const date = new Date(session.date);
            dateTd.textContent = new Intl.DateTimeFormat('tr-TR', { 
                month: 'short', day: 'numeric', year: 'numeric' 
            }).format(date);
            dateRow.appendChild(dateTd);
            table.appendChild(dateRow);
            
            // Header for sets
            const headerRow = document.createElement('tr');
            headerRow.innerHTML = `<th>Set</th><th>Ağırlık</th><th>Tekrar</th>`;
            table.appendChild(headerRow);
            
            // Sets
            session.sets.forEach((set, index) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${set.weight} kg</td>
                    <td>${set.reps}</td>
                `;
                table.appendChild(tr);
            });
        });
        
        container.appendChild(table);
    }
};
