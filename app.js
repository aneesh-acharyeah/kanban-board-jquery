/* Kanban Mini — app.js (jQuery + jQuery UI)
   Features:
   - Add / rename / delete columns
   - Add / edit / delete cards
   - Drag & drop cards between columns & reorder (jQuery UI sortable)
   - Reorder columns (sortable)
   - localStorage persistence
   - Export / Import JSON
   - Simple modal edit for cards
*/

// --- Constants & Storage key
const STORAGE_KEY = "kanban_mini_v1";

// --- Helpers
function uid(prefix = "id") { return prefix + "_" + Math.random().toString(36).slice(2,9); }
function save(board) { localStorage.setItem(STORAGE_KEY, JSON.stringify(board)); }
function load() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || null } catch(e){ return null } }

// --- Default board if empty
function defaultBoard(){
  return {
    columns: [
      { id: uid("col"), title: "Todo", cards: [ { id: uid("c"), title: "Welcome to Kanban", desc: "Drag me to other columns", tag: "demo" } ] },
      { id: uid("col"), title: "Doing", cards: [] },
      { id: uid("col"), title: "Done", cards: [] },
    ]
  };
}

// --- Renderers
function renderBoard(board){
  const $board = $("#board");
  $board.empty();
  if (!board.columns.length) {
    $("#emptyNote").show();
  } else {
    $("#emptyNote").hide();
  }

  board.columns.forEach(col => {
    const $col = $(`
      <div class="column" data-col-id="${col.id}">
        <div class="col-head">
          <div class="col-title"><span class="col-name">${escapeHtml(col.title)}</span></div>
          <div class="col-actions">
            <button class="btn edit-col" title="Rename"><i class="fa-solid fa-pen-to-square"></i></button>
            <button class="btn del-col" title="Delete"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
        <div class="col-content" data-col-content="${col.id}"></div>
        <div class="add-card">
          <input placeholder="Add card title..." class="new-card-input" />
          <button class="btn add-card-btn"><i class="fa-solid fa-plus"></i></button>
        </div>
      </div>
    `);

    // append cards
    const $content = $col.find(".col-content");
    col.cards.forEach(card => {
      const tagHtml = card.tag ? `<span class="tag">${escapeHtml(card.tag)}</span>` : "";
      const $card = $(`
        <div class="card" data-card-id="${card.id}">
          <div class="title">${escapeHtml(card.title)}</div>
          <div class="meta">
            <div class="tag-wrap">${tagHtml}</div>
            <div class="card-actions">
              <button class="btn edit-card" title="Edit"><i class="fa-solid fa-pen"></i></button>
              <button class="btn del-card" title="Delete"><i class="fa-solid fa-trash"></i></button>
            </div>
          </div>
        </div>
      `);
      $content.append($card);
    });

    $board.append($col);
  });

  // make columns sortable (cards)
  $(".col-content").sortable({
    connectWith: ".col-content",
    placeholder: "ui-sortable-placeholder",
    items: ".card",
    tolerance: "pointer",
    revert: 150,
    start: function(e, ui){ ui.placeholder.height(ui.item.outerHeight()); },
    stop: function(){ syncFromDOM(); }
  }).disableSelection();

  // make columns reorderable
  $("#board").sortable({
    items: ".column",
    handle: ".col-head",
    axis: "x",
    stop: function(){ syncColumnsFromDOM(); }
  });

  bindHandlers();
}

// --- Bind UI handlers for dynamic elements
function bindHandlers(){
  // Add card in column
  $(".add-card-btn").off("click").on("click", function(){
    const $col = $(this).closest(".column");
    const colId = $col.data("col-id");
    const val = $col.find(".new-card-input").val().trim();
    if (!val) return;
    addCard(colId, { id: uid("c"), title: val, desc: "", tag: "" });
    $col.find(".new-card-input").val("");
  });

  // Enter key to add card
  $(".new-card-input").off("keydown").on("keydown", function(e){
    if (e.key === "Enter") $(this).siblings(".add-card-btn").click();
  });

  // Delete card
  $(".del-card").off("click").on("click", function(){
    const $card = $(this).closest(".card");
    const cardId = $card.data("card-id");
    if (!confirm("Delete this card?")) return;
    removeCardById(cardId);
  });

  // Edit card (open modal)
  $(".edit-card").off("click").on("click", function(){
    const $card = $(this).closest(".card");
    const cardId = $card.data("card-id");
    openEditCardModal(cardId);
  });

  // Edit column title
  $(".edit-col").off("click").on("click", function(){
    const $col = $(this).closest(".column");
    const colId = $col.data("col-id");
    const current = getBoard().columns.find(c=>c.id===colId);
    const nv = prompt("Rename column", current.title);
    if (nv !== null) { current.title = nv.trim() || current.title; save(getBoard()); renderBoard(getBoard()); }
  });

  // Delete column
  $(".del-col").off("click").on("click", function(){
    const $col = $(this).closest(".column");
    const colId = $col.data("col-id");
    if (!confirm("Delete column and all cards?")) return;
    removeColumn(colId);
  });

  // Card click to open edit too (double affordance)
  $(".card").off("dblclick").on("dblclick", function(){
    const cardId = $(this).data("card-id");
    openEditCardModal(cardId);
  });
}

// --- CRUD operations for board structure
function getBoard(){
  return load() || defaultBoard();
}
function setBoard(board){
  save(board);
  renderBoard(board);
}
function addColumn(title){
  const board = getBoard();
  board.columns.push({ id: uid("col"), title: title || "New Column", cards: [] });
  setBoard(board);
}
function removeColumn(colId){
  const board = getBoard();
  board.columns = board.columns.filter(c=>c.id!==colId);
  setBoard(board);
}
function addCard(colId, card){
  const board = getBoard();
  const col = board.columns.find(c=>c.id===colId);
  if (!col) return;
  col.cards.unshift(card);
  setBoard(board);
}
function removeCardById(cardId){
  const board = getBoard();
  board.columns.forEach(c => { c.cards = c.cards.filter(card => card.id !== cardId); });
  setBoard(board);
}
function updateCard(cardId, patch){
  const board = getBoard();
  for (const c of board.columns){
    const card = c.cards.find(x=>x.id===cardId);
    if (card){ Object.assign(card, patch); break; }
  }
  setBoard(board);
}

// --- Sync functions (read finished DOM order back to model)
function syncFromDOM(){
  const board = { columns: [] };
  $("#board .column").each(function(){
    const $col = $(this);
    const colId = $col.data("col-id");
    const title = $col.find(".col-name").text().trim();
    const cards = [];
    $col.find(".card").each(function(){
      const cid = $(this).data("card-id");
      // find card details from existing board (to get desc/tag)
      const existing = findCardById(cid);
      if (existing) cards.push(Object.assign({}, existing));
      else cards.push({ id: cid, title: $(this).find(".title").text().trim(), desc: "", tag: "" });
    });
    board.columns.push({ id: colId, title, cards });
  });
  save(board);
  renderBoard(board);
}
function syncColumnsFromDOM(){
  // keep cards positions too
  syncFromDOM();
}

function findCardById(cardId){
  const board = getBoard();
  for (const c of board.columns){
    for (const card of c.cards) if (card.id === cardId) return card;
  }
  return null;
}

// --- Card edit modal (jQuery UI dialog)
function openEditCardModal(cardId){
  const card = findCardById(cardId);
  if (!card) return alert("Card not found");
  $("#cardTitle").val(card.title || "");
  $("#cardDesc").val(card.desc || "");
  $("#cardTag").val(card.tag || "");
  $("#modal").dialog({
    modal: true,
    width: 520,
    close: function(){ $(this).dialog("destroy"); },
    open: function(){ $(".ui-widget-overlay").on("click", function(){ $("#modal").dialog("close"); }); }
  });

  $("#cardForm").off("submit").on("submit", function(e){
    e.preventDefault();
    const patch = { title: $("#cardTitle").val().trim(), desc: $("#cardDesc").val().trim(), tag: $("#cardTag").val().trim() };
    updateCard(cardId, patch);
    $("#modal").dialog("close");
  });
}

// --- Export / Import
function exportJSON(){
  const data = JSON.stringify(getBoard(), null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "kanban_board.json";
  a.click();
  URL.revokeObjectURL(url);
}
function importJSONFile(file){
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e){
    try {
      const parsed = JSON.parse(e.target.result);
      if (!parsed || !Array.isArray(parsed.columns)) throw new Error("Invalid format");
      save(parsed);
      renderBoard(parsed);
      alert("Imported board");
    } catch(err){ alert("Import failed: " + err.message); }
  };
  reader.readAsText(file);
}

// --- Utility
function escapeHtml(s){
  return String(s||"").replace(/[&<>"']/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[m]));
}

// --- UI control wiring (static controls)
$(function(){
  // initial render
  const board = getBoard();
  renderBoard(board);

  // Add column button
  $("#addColumnBtn").on("click", function(){
    const title = prompt("Column title", "New Column");
    if (title === null) return;
    addColumn(title.trim() || "New Column");
  });

  // Export
  $("#exportBtn").on("click", exportJSON);

  // Import
  $("#importBtn").on("click", function(){ $("#importFile").click(); });
  $("#importFile").on("change", function(e){ const f = e.target.files && e.target.files[0]; if (f) importJSONFile(f); this.value = ""; });

  // Reset
  $("#resetBtn").on("click", function(){
    if (!confirm("Reset board to default? This will erase current board.")) return;
    const def = defaultBoard();
    save(def);
    renderBoard(def);
  });

  // Double-click column title to rename
  $(document).on("dblclick", ".col-name", function(){
    const $col = $(this).closest(".column");
    const colId = $col.data("col-id");
    const current = getBoard().columns.find(c=>c.id===colId);
    const nv = prompt("Rename column", current.title);
    if (nv !== null){ current.title = nv.trim() || current.title; save(getBoard()); renderBoard(getBoard()); }
  });

  // Click card title to open modal (single click)
  $(document).on("click", ".card .title", function(){
    const cardId = $(this).closest(".card").data("card-id");
    openEditCardModal(cardId);
  });

  // ensure controls reflect state
  enableControls(true);
});
