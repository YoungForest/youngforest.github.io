'use strict';
(() => {
  document.querySelectorAll('[data-discovery-reading]').forEach(section => {
    const controls=section.querySelector('.discovery-filters'),notes=[...section.querySelectorAll('[data-note-kind]')],status=section.querySelector('.discovery-count');
    controls.hidden=false;
    controls.addEventListener('click',event=>{
      const button=event.target.closest('button[data-kind]');
      if(!button)return;
      controls.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
      let count=0;
      notes.forEach(note=>{note.hidden=button.dataset.kind!=='all'&&note.dataset.noteKind!==button.dataset.kind;if(!note.hidden)count++;});
      status.textContent=count+' '+section.dataset.countUnit;
    });
  });
})();
