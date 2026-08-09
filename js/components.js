import { Store } from './store.js';

export const Components = {
    renderExerciseCardCompact(exerciseEntry, exerciseDef, onClick) {
        const card = document.createElement('div');
        card.className = 'exercise-card exercise-card-compact';
        card.dataset.id = exerciseDef.id;

        const header = document.createElement('div');
        header.className = 'exercise-header';
        
        const title = document.createElement('div');
        title.className = 'exercise-name';
        title.textContent = exerciseDef.name;

        header.appendChild(title);
        card.appendChild(header);

        const summary = document.createElement('div');
        summary.className = 'exercise-summary-text';
        
        if (exerciseEntry.sets.length === 0) {
            summary.textContent = 'Set eklenmedi.';
        } else {
            const setTexts = exerciseEntry.sets.map((s) => {
                const check = s.completed ? ' <span class="set-check-tick">✓</span>' : '';
                return `${s.weight}x${s.reps}${check}`;
            });
            summary.innerHTML = `<strong>${exerciseEntry.sets.length} Set:</strong> ${setTexts.join(', ')}`;
        }

        card.appendChild(summary);
        card.onclick = onClick;

        return card;
    },

    renderSetRow(set, setNumber, prevSet, onUpdate, onToggle, onDelete) {
        const rowWrapper = document.createElement('div');
        rowWrapper.style.display = 'flex';
        rowWrapper.style.flexDirection = 'column';
        rowWrapper.style.borderBottom = '1px solid var(--border-color)';
        rowWrapper.style.padding = 'var(--spacing-sm) 0';

        const row = document.createElement('div');
        row.style.display = 'grid';
        row.style.gridTemplateColumns = '32px 1fr 1fr 40px 40px';
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
        
        // Delete Set Button
        const delBtn = document.createElement('button');
        delBtn.className = 'set-delete-btn';
        delBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
        delBtn.onclick = () => {
            onDelete(setNumber - 1);
        };
        row.appendChild(delBtn);
        
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

        const input = document.createElement('input');
        input.type = 'number';
        input.value = value || '';
        input.inputMode = 'decimal';
        input.onchange = (e) => {
            let val = parseFloat(e.target.value) || 0;
            if (val < 0) val = 0;
            onChange(val);
        };

        group.appendChild(input);

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
        const dateStr = new Intl.DateTimeFormat('tr-TR', { 
            weekday: 'short', month: 'short', day: 'numeric'
        }).format(date);
        
        if (session.name && session.name.trim() !== '') {
            title.textContent = `${session.name} (${dateStr})`;
        } else {
            title.textContent = `Antrenman - ${dateStr}`;
        }
        
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
