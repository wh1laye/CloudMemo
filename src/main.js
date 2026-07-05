// ===== БЕЗ ES6 imports! marked загружается через CDN =====

const { invoke } = window.__TAURI__.core;

const notesList = document.getElementById('notesList');
const newNoteBtn = document.getElementById('newNoteBtn');
const searchInput = document.getElementById('searchInput');
const emptyState = document.getElementById('emptyState');
const editorArea = document.getElementById('editorArea');
const noteTitle = document.getElementById('noteTitle');
const editor = document.getElementById('editor');
const preview = document.getElementById('preview');
const deleteBtn = document.getElementById('deleteBtn');
const saveStatus = document.getElementById('saveStatus');

let currentNote = null;
let allNotes = [];
let saveTimeout = null;

console.log('[JS] ========================================');
console.log('[JS] CloudMemo started');
console.log('[JS] window.__TAURI__:', window.__TAURI__);
console.log('[JS] window.marked:', window.marked);
console.log('[JS] invoke:', typeof invoke);

if (!window.__TAURI__) {
  console.error('[JS] ❌ Tauri API недоступен!');
}
if (!window.marked) {
  console.error('[JS] ❌ marked не загружен! Проверь интернет.');
}

// ===== Загрузка списка заметок =====
async function loadNotes() {
  try {
    console.log('[JS] loadNotes() вызван');
    allNotes = await invoke('list_notes');
    console.log('[JS] Получено заметок:', allNotes.length, allNotes);
    renderNotesList(allNotes);
  } catch (err) {
    console.error('[JS] ❌ Ошибка loadNotes:', err);
  }
}

function renderNotesList(notes) {
  notesList.innerHTML = '';
  
  if (notes.length === 0) {
    notesList.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary); font-size: 13px;">Нет заметок. Нажми + чтобы создать</div>';
    return;
  }
  
  notes.forEach(note => {
    const item = document.createElement('div');
    item.className = 'note-item';
    if (currentNote && currentNote.name === note.name) {
      item.classList.add('active');
    }
    
    const previewText = note.content.replace(/^#+\s+/gm, '').replace(/[*_`]/g, '').substring(0, 60);
    
    item.innerHTML = `
      <div class="note-item-title">${escapeHtml(note.name)}</div>
      <div class="note-item-date">${note.updated || '—'}</div>
      <div class="note-item-preview">${escapeHtml(previewText) || 'Пустая заметка'}</div>
    `;
    
    item.addEventListener('click', () => openNote(note.name));
    notesList.appendChild(item);
  });
}

async function openNote(name) {
  try {
    console.log('[JS] openNote:', name);
    const content = await invoke('read_note', { name });
    currentNote = { name, content };
    
    noteTitle.value = name;
    editor.value = content;
    updatePreview();
    
    emptyState.classList.add('hidden');
    editorArea.classList.remove('hidden');
    
    renderNotesList(allNotes);
  } catch (err) {
    console.error('[JS] ❌ Ошибка openNote:', err);
  }
}

// ===== КНОПКА СОЗДАТЬ =====
newNoteBtn.addEventListener('click', async () => {
  console.log('[JS] === КНОПКА СОЗДАТЬ НАЖАТА ===');
  
  const name = 'Заметка ' + new Date().toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).replace(',', '');
  
  console.log('[JS] Создаю заметку с именем:', name);
  
  try {
    console.log('[JS] Вызываю save_note...');
    const savedName = await invoke('save_note', { 
      name: name, 
      content: '# ' + name + '\n\nНачни писать здесь...\n' 
    });
    console.log('[JS] ✅ Сохранено как:', savedName);
    
    console.log('[JS] Перезагружаю список...');
    await loadNotes();
    
    console.log('[JS] Открываю новую заметку...');
    await openNote(savedName);
    
    console.log('[JS] ✅ Готово!');
  } catch (err) {
    console.error('[JS] ❌ ОШИБКА создания:', err);
    alert('Ошибка создания заметки: ' + err);
  }
});

deleteBtn.addEventListener('click', async () => {
  if (!currentNote) return;
  if (!confirm(`Удалить заметку "${currentNote.name}"?`)) return;
  
  try {
    await invoke('delete_note', { name: currentNote.name });
    currentNote = null;
    editorArea.classList.add('hidden');
    emptyState.classList.remove('hidden');
    await loadNotes();
  } catch (err) {
    console.error('[JS] Ошибка удаления:', err);
  }
});

function updatePreview() {
  if (window.marked && window.marked.parse) {
    preview.innerHTML = window.marked.parse(editor.value || '');
  } else {
    preview.textContent = editor.value || '';
  }
}

async function saveCurrentNote() {
  if (!currentNote) return;
  
  const newName = noteTitle.value.trim() || currentNote.name;
  
  try {
    saveStatus.textContent = 'Сохранение...';
    saveStatus.classList.add('saving');
    
    const savedName = await invoke('save_note', {
      name: newName,
      content: editor.value
    });
    
    if (savedName !== currentNote.name) {
      await invoke('delete_note', { name: currentNote.name });
      currentNote.name = savedName;
    }
    
    saveStatus.textContent = 'Сохранено ✓';
    saveStatus.classList.remove('saving');
    
    await loadNotes();
  } catch (err) {
    console.error('[JS] Ошибка сохранения:', err);
    saveStatus.textContent = 'Ошибка!';
  }
}

function scheduleSave() {
  saveStatus.textContent = 'Изменения...';
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveCurrentNote, 800);
}

editor.addEventListener('input', () => {
  updatePreview();
  scheduleSave();
});

noteTitle.addEventListener('input', scheduleSave);

searchInput.addEventListener('input', () => {
  const query = searchInput.value.toLowerCase();
  if (!query) {
    renderNotesList(allNotes);
    return;
  }
  const filtered = allNotes.filter(note =>
    note.name.toLowerCase().includes(query) ||
    note.content.toLowerCase().includes(query)
  );
  renderNotesList(filtered);
});

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Старт
loadNotes();
