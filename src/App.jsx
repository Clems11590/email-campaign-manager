import React, { useState, useEffect } from 'react';
import { Upload, Plus, Search, Calendar as CalendarIcon, Filter, AlertCircle, CheckCircle, Clock, TrendingUp, Download, X, Trash2, Archive, ArchiveRestore, Link as LinkIcon, ExternalLink, Image, Layout, Mail, Copy, Check, MessageSquare, FolderOpen } from 'lucide-react';
import { supabase, handleSupabaseError } from './supabaseClient';

const EmailManagementTool = () => {
  const [activeEntity, setActiveEntity] = useState('J4C');
  const [entities, setEntities] = useState([]);
  const [operations, setOperations] = useState([]);
  const [operationType, setOperationType] = useState('email');
  const [messageTemplates, setMessageTemplates] = useState([]);
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showCampaigns, setShowCampaigns] = useState(false);
  const [filters, setFilters] = useState({
    creaRealisee: false,
    batValide: false,
    dansSRE: false,
    pasDansSRE: false,
    archives: false,
    thematique: '',
    langue: '',
    dateDebut: '',
    dateFin: ''
  });

  const loadEntities = async () => {
    const { data, error } = await supabase.from('entities').select('*').order('name');
    if (!handleSupabaseError(error)) {
      setEntities(data || []);
      if (data && data.length > 0 && !activeEntity) setActiveEntity(data[0].name);
    }
  };

  const loadOperations = async () => {
    if (!activeEntity) return;
    setLoading(true);
    const activeEntityData = entities.find(e => e.name === activeEntity);
    if (!activeEntityData) return;
    const { data, error } = await supabase.from('operations').select('*').eq('entity_id', activeEntityData.id).eq('type', operationType).order('date_envoi', { ascending: true });
    if (!handleSupabaseError(error)) setOperations(data || []);
    setLoading(false);
  };

  const loadMessageTemplates = async () => {
    const activeEntityData = entities.find(e => e.name === activeEntity);
    if (!activeEntityData) return;
    const { data, error } = await supabase.from('message_templates').select('*').eq('entity_id', activeEntityData.id).eq('is_active', true);
    if (!handleSupabaseError(error)) setMessageTemplates(data || []);
  };

  useEffect(() => { loadEntities(); }, []);
  useEffect(() => { if (entities.length > 0) { loadOperations(); loadMessageTemplates(); } }, [activeEntity, entities, operationType]);

  useEffect(() => {
    const activeEntityData = entities.find(e => e.name === activeEntity);
    if (!activeEntityData) return;
    const subscription = supabase.channel('operations-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'operations', filter: `entity_id=eq.${activeEntityData.id}` }, () => { loadOperations(); }).subscribe();
    return () => { subscription.unsubscribe(); };
  }, [activeEntity, entities, operationType]);

  const generateMessage = (template, operation) => {
    if (!template || !operation) return '';
    const dateFormatted = new Date(operation.date_envoi).toLocaleDateString('fr-FR');
    const variables = { '{{titre}}': operation.titre || '', '{{date_envoi}}': dateFormatted, '{{type}}': operation.type === 'email' ? 'Email' : 'Slider', '{{thematique}}': operation.thematique || '', '{{langue}}': operation.langue || '', '{{entity}}': activeEntity, '{{brief}}': operation.brief || '' };
    let subject = template.subject || '';
    let body = template.body || '';
    Object.keys(variables).forEach(key => { subject = subject.replace(new RegExp(key, 'g'), variables[key]); body = body.replace(new RegExp(key, 'g'), variables[key]); });
    return subject ? `Sujet : ${subject}\n\n${body}` : body;
  };

  const copyMessageToClipboard = async (triggerEvent, operation) => {
    const template = messageTemplates.find(t => t.trigger_event === triggerEvent);
    if (!template) { alert('❌ Aucun template configuré'); return; }
    const message = generateMessage(template, operation);
    try {
      await navigator.clipboard.writeText(message);
      await supabase.from('sent_messages').insert([{ operation_id: operation.id, template_id: template.id, subject: template.subject, body: message }]);
      setCopiedMessageId(operation.id + triggerEvent);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (error) { alert('❌ Erreur : ' + error.message); }
  };

  const addOperation = async (operationData) => {
    const activeEntityData = entities.find(e => e.name === activeEntity);
    if (!activeEntityData) return;
    const baseData = { entity_id: activeEntityData.id, type: operationType, date_envoi: operationData.dateEnvoi, titre: operationData.titre, thematique: operationData.thematique, langue: operationData.langue || 'FR', brief: operationData.brief || '', produits: [], crea_realisee: false, bat_envoye_eric: false, bat_envoye_marketing: false, bat_valide: false, dans_planning_sre: false, archived: false };
    if (operationType === 'email') { baseData.objet = ''; baseData.preheader = ''; baseData.corps = ''; } 
    else { baseData.titre_slider = ''; baseData.sous_titre_slider = ''; baseData.texte_bouton = ''; baseData.lien_bouton = ''; baseData.image_url = ''; baseData.position_slider = operationData.position_slider || 'homepage'; }
    const { error } = await supabase.from('operations').insert([baseData]);
    if (!handleSupabaseError(error)) { setShowAddModal(false); loadOperations(); }
  };

  const handleCSVImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const parseCSVLine = (line) => {
          const result = [];
          let current = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];
            if (char === '"') { if (inQuotes && nextChar === '"') { current += '"'; i++; } else { inQuotes = !inQuotes; } } 
            else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; } 
            else { current += char; }
          }
          result.push(current.trim());
          return result;
        };
        const lines = text.split(/\r?\n/).filter(line => line.trim());
        if (lines.length < 2) { alert('❌ Fichier vide'); return; }
        const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '').replace(/[éèêë]/g, 'e').replace(/[àâä]/g, 'a'));
        const hasDate = headers.some(h => h.includes('date') || h === 'dateenvoi');
        if (!hasDate) { alert('❌ Colonne date manquante'); return; }
        const activeEntityData = entities.find(e => e.name === activeEntity);
        if (!activeEntityData) return;
        const newOperations = [];
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          const values = parseCSVLine(lines[i]);
          const opObj = {};
          headers.forEach((header, index) => { opObj[header] = values[index] || ''; });
          const dateValue = opObj.dateenvoi || opObj.date;
          if (dateValue && dateValue.trim()) {
            const baseOp = { entity_id: activeEntityData.id, type: operationType, date_envoi: dateValue.trim(), titre: opObj.titre || 'Sans titre', thematique: opObj.thematique || '', langue: opObj.langue || 'FR', brief: opObj.brief || '', produits: [] };
            if (operationType === 'slider') baseOp.position_slider = opObj.position || 'homepage';
            newOperations.push(baseOp);
          }
        }
        if (newOperations.length === 0) { alert('❌ Aucune opération valide'); return; }
        const { error } = await supabase.from('operations').insert(newOperations);
        if (!handleSupabaseError(error)) { alert(`✅ ${newOperations.length} opération(s) importée(s)`); setShowImportModal(false); loadOperations(); }
      } catch (error) { alert('❌ Erreur : ' + error.message); }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const updateOperation = async (operationId, updates) => {
    const { error } = await supabase.from('operations').update(updates).eq('id', operationId);
    if (!handleSupabaseError(error)) loadOperations();
  };

  const deleteOperation = async (operationId) => {
    if (window.confirm('⚠️ Supprimer ?')) {
      const { error } = await supabase.from('operations').delete().eq('id', operationId);
      if (!handleSupabaseError(error)) loadOperations();
    }
  };

  const archiveOperation = async (operationId) => {
    if (window.confirm('📦 Archiver ?')) {
      const { error } = await supabase.from('operations').update({ archived: true, archived_at: new Date().toISOString() }).eq('id', operationId);
      if (!handleSupabaseError(error)) loadOperations();
    }
  };

  const unarchiveOperation = async (operationId) => {
    const { error } = await supabase.from('operations').update({ archived: false, archived_at: null }).eq('id', operationId);
    if (!handleSupabaseError(error)) loadOperations();
  };

  const getAlertStatus = (dateEnvoi) => {
    const today = new Date();
    const sendDate = new Date(dateEnvoi);
    const diffDays = Math.ceil((sendDate - today) / (1000 * 60 * 60 * 24));
    if (diffDays <= 5 && diffDays >= 0) return { show: true, days: diffDays };
    return { show: false };
  };

  const getFilteredOperations = () => {
    let filtered = [...operations];
    if (!filters.archives) filtered = filtered.filter(e => !e.archived);
    else filtered = filtered.filter(e => e.archived);
    if (filters.creaRealisee) filtered = filtered.filter(e => e.crea_realisee);
    if (filters.batValide) filtered = filtered.filter(e => e.bat_valide);
    if (filters.dansSRE) filtered = filtered.filter(e => e.dans_planning_sre);
    if (filters.pasDansSRE) filtered = filtered.filter(e => !e.dans_planning_sre);
    if (filters.thematique) filtered = filtered.filter(e => e.thematique?.toLowerCase().includes(filters.thematique.toLowerCase()));
    if (filters.langue) filtered = filtered.filter(e => e.langue === filters.langue);
    if (filters.dateDebut) filtered = filtered.filter(e => new Date(e.date_envoi) >= new Date(filters.dateDebut));
    if (filters.dateFin) filtered = filtered.filter(e => new Date(e.date_envoi) <= new Date(filters.dateFin));
    return filtered.sort((a, b) => new Date(a.date_envoi) - new Date(b.date_envoi));
  };

  const addEntity = async () => {
    const newEntity = prompt('Nom :');
    if (newEntity && !entities.find(e => e.name === newEntity)) {
      const { error } = await supabase.from('entities').insert([{ name: newEntity }]);
      if (!handleSupabaseError(error)) loadEntities();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700&display=swap');*{font-family:'Sora',sans-serif}.card-hover{transition:all .3s}.card-hover:hover{transform:translateY(-2px);box-shadow:0 20px 25px -5px rgba(251,146,60,.1)}.tab-active{background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;box-shadow:0 10px 15px -3px rgba(249,115,22,.3)}.checkbox-custom{appearance:none;width:20px;height:20px;border:2px solid #fb923c;border-radius:4px;cursor:pointer;position:relative;transition:all .2s}.checkbox-custom:checked{background:linear-gradient(135deg,#f97316,#ea580c);border-color:#ea580c}.checkbox-custom:checked::after{content:'✓';position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#fff;font-size:14px;font-weight:700}.gradient-text{background:linear-gradient(135deg,#f97316,#ea580c);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}.btn-primary{background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-weight:600;transition:all .3s}.btn-primary:hover{transform:translateY(-2px);box-shadow:0 10px 15px -3px rgba(249,115,22,.4)}.btn-secondary{background:#fff;color:#f97316;border:2px solid #f97316;padding:10px 20px;border-radius:8px;cursor:pointer;font-weight:600;transition:all .3s}.btn-secondary:hover{background:#fff7ed}.sync-indicator{animation:sync-pulse 2s ease-in-out infinite}@keyframes sync-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.1)}}.type-selector{display:inline-flex;background:#fff;border-radius:8px;padding:4px;border:2px solid #fed7aa}.type-option{padding:8px 16px;border-radius:6px;cursor:pointer;transition:all .2s;font-weight:600;font-size:14px}.type-option:hover{background:#fff7ed}.type-option.active{background:linear-gradient(135deg,#f97316,#ea580c);color:#fff}`}</style>

      <div className="bg-white/80 backdrop-blur-lg border-b-2 border-orange-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold gradient-text">Campaign Manager V3</h1>
                <span className="sync-indicator bg-green-500 w-3 h-3 rounded-full"></span>
              </div>
              <p className="text-sm text-gray-600 mt-1">Templates • Campagnes • Calendrier • Temps réel</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowImportModal(true)} className="btn-secondary flex items-center gap-2"><Upload size={18} />Import CSV</button>
              <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2"><Plus size={18} />Nouvelle opération</button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-6">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {entities.map(entity => (
            <button key={entity.id} onClick={() => { setActiveEntity(entity.name); setShowAnalytics(false); setShowCalendar(false); setShowCampaigns(false); }} className={`px-6 py-3 rounded-lg font-semibold whitespace-nowrap transition-all ${activeEntity === entity.name && !showAnalytics && !showCalendar && !showCampaigns ? 'tab-active' : 'bg-white hover:bg-orange-50 text-gray-700'}`}>{entity.name}</button>
          ))}
          <button onClick={() => { setShowCampaigns(true); setShowAnalytics(false); setShowCalendar(false); }} className={`px-6 py-3 rounded-lg font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${showCampaigns ? 'tab-active' : 'bg-white hover:bg-orange-50 text-gray-700'}`}><FolderOpen size={18} />Campagnes</button>
          <button onClick={() => { setShowCalendar(true); setShowAnalytics(false); setShowCampaigns(false); }} className={`px-6 py-3 rounded-lg font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${showCalendar ? 'tab-active' : 'bg-white hover:bg-orange-50 text-gray-700'}`}><CalendarIcon size={18} />Calendrier</button>
          <button onClick={() => { setShowAnalytics(true); setShowCalendar(false); setShowCampaigns(false); }} className={`px-6 py-3 rounded-lg font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${showAnalytics ? 'tab-active' : 'bg-white hover:bg-orange-50 text-gray-700'}`}><TrendingUp size={18} />Analytics</button>
          <button onClick={addEntity} className="px-4 py-3 rounded-lg bg-orange-100 hover:bg-orange-200 text-orange-700 font-semibold"><Plus size={18} /></button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {showCampaigns ? <CampaignsView entities={entities} /> : showCalendar ? <CalendarView entities={entities} /> : showAnalytics ? <AnalyticsView entities={entities} /> : (
          <>
            <div className="mb-6 flex items-center justify-between">
              <div className="type-selector">
                <button onClick={() => setOperationType('email')} className={`type-option flex items-center gap-2 ${operationType === 'email' ? 'active' : ''}`}><Mail size={16} />Emails</button>
                <button onClick={() => setOperationType('slider')} className={`type-option flex items-center gap-2 ${operationType === 'slider' ? 'active' : ''}`}><Layout size={16} />Sliders</button>
              </div>
              <div className="text-sm text-gray-600">{getFilteredOperations().length} {operationType === 'email' ? 'email(s)' : 'slider(s)'}</div>
            </div>
            <FilterPanel filters={filters} setFilters={setFilters} />
            <div className="space-y-4">
              {loading ? <div className="bg-white/80 rounded-2xl p-12 text-center border-2 border-orange-200"><div className="text-6xl mb-4">⏳</div><h3 className="text-xl font-bold text-gray-700">Chargement...</h3></div> : getFilteredOperations().length === 0 ? <div className="bg-white/80 rounded-2xl p-12 text-center border-2 border-orange-200"><div className="text-6xl mb-4">{operationType === 'email' ? '📧' : '🖼️'}</div><h3 className="text-xl font-bold text-gray-700">Aucun{operationType === 'email' ? ' email' : 'e slider'}</h3></div> : getFilteredOperations().map(operation => <OperationCard key={operation.id} operation={operation} onUpdate={(updates) => updateOperation(operation.id, updates)} onDelete={() => deleteOperation(operation.id)} onArchive={() => archiveOperation(operation.id)} onUnarchive={() => unarchiveOperation(operation.id)} alert={getAlertStatus(operation.date_envoi)} messageTemplates={messageTemplates} copyMessageToClipboard={copyMessageToClipboard} copiedMessageId={copiedMessageId} />)}
            </div>
          </>
        )}
      </div>

      {showAddModal && <AddOperationModal operationType={operationType} onClose={() => setShowAddModal(false)} onAdd={addOperation} />}
      {showImportModal && <ImportCSVModal onClose={() => setShowImportModal(false)} onImport={handleCSVImport} />}
    </div>
  );
};

const FilterPanel = ({ filters, setFilters }) => (
  <div className="bg-white/80 rounded-2xl p-6 mb-6 border-2 border-orange-200">
    <div className="flex items-center gap-3 mb-4"><Filter size={20} className="text-orange-600" /><h2 className="text-lg font-bold text-gray-800">Filtres</h2></div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" className="checkbox-custom" checked={filters.creaRealisee} onChange={(e) => setFilters({ ...filters, creaRealisee: e.target.checked })} /><span className="text-sm font-medium">Créa réalisée</span></label>
      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" className="checkbox-custom" checked={filters.batValide} onChange={(e) => setFilters({ ...filters, batValide: e.target.checked })} /><span className="text-sm font-medium">BAT validé</span></label>
      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" className="checkbox-custom" checked={filters.dansSRE} onChange={(e) => setFilters({ ...filters, dansSRE: e.target.checked })} /><span className="text-sm font-medium">Dans SRE</span></label>
      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" className="checkbox-custom" checked={filters.pasDansSRE} onChange={(e) => setFilters({ ...filters, pasDansSRE: e.target.checked })} /><span className="text-sm font-medium">Pas dans SRE</span></label>
      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" className="checkbox-custom" checked={filters.archives} onChange={(e) => setFilters({ ...filters, archives: e.target.checked })} /><span className="text-sm font-medium">📦 Archivés</span></label>
      <input type="text" placeholder="Thématique..." className="px-4 py-2 border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:outline-none" value={filters.thematique} onChange={(e) => setFilters({ ...filters, thematique: e.target.value })} />
      <select className="px-4 py-2 border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:outline-none" value={filters.langue} onChange={(e) => setFilters({ ...filters, langue: e.target.value })}><option value="">Toutes langues</option><option value="FR">FR</option><option value="EN">EN</option><option value="DE">DE</option><option value="ES">ES</option><option value="IT">IT</option></select>
      <input type="date" className="px-4 py-2 border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:outline-none" value={filters.dateDebut} onChange={(e) => setFilters({ ...filters, dateDebut: e.target.value })} />
      <input type="date" className="px-4 py-2 border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:outline-none" value={filters.dateFin} onChange={(e) => setFilters({ ...filters, dateFin: e.target.value })} />
    </div>
    <button onClick={() => setFilters({ creaRealisee: false, batValide: false, dansSRE: false, pasDansSRE: false, archives: false, thematique: '', langue: '', dateDebut: '', dateFin: '' })} className="mt-4 text-sm text-orange-600 hover:text-orange-700 font-semibold">Réinitialiser</button>
  </div>
);

const OperationCard = ({ operation, onUpdate, onDelete, onArchive, onUnarchive, alert, messageTemplates, copyMessageToClipboard, copiedMessageId }) => {
  const [expanded, setExpanded] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);

  const hasTemplate = (triggerEvent) => messageTemplates && messageTemplates.some(t => t.trigger_event === triggerEvent);

  const addProduct = async (product) => {
    const updatedProducts = [...(operation.produits || []), product];
    onUpdate({ produits: updatedProducts });
    setShowProductModal(false);
  };

  const removeProduct = async (index) => {
    const updatedProducts = (operation.produits || []).filter((_, i) => i !== index);
    onUpdate({ produits: updatedProducts });
  };

  return (
    <div className="bg-white/90 backdrop-blur-lg rounded-2xl p-6 border-2 border-orange-200 card-hover">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xl font-bold text-gray-800">{operation.type === 'email' ? '📧' : '🖼️'} {operation.titre}</h3>
            {alert.show && <span className="alert-badge bg-red-500 text-white text-xs px-3 py-1 rounded-full font-semibold">J-{alert.days}</span>}
            {operation.archived && <span className="bg-gray-400 text-white text-xs px-3 py-1 rounded-full">Archivé</span>}
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>📅 {new Date(operation.date_envoi).toLocaleDateString('fr-FR')}</span>
            {operation.thematique && <span>🏷️ {operation.thematique}</span>}
            <span>🌐 {operation.langue}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {!operation.archived && <button onClick={() => onArchive()} className="p-2 hover:bg-orange-100 rounded-lg transition-colors"><Archive size={18} className="text-gray-600" /></button>}
          {operation.archived && <button onClick={() => onUnarchive()} className="p-2 hover:bg-green-100 rounded-lg transition-colors"><ArchiveRestore size={18} className="text-green-600" /></button>}
          <button onClick={() => onDelete()} className="p-2 hover:bg-red-100 rounded-lg transition-colors"><Trash2 size={18} className="text-red-600" /></button>
          <button onClick={() => setExpanded(!expanded)} className="p-2 hover:bg-orange-100 rounded-lg transition-colors"><span className="text-orange-600">{expanded ? '▲' : '▼'}</span></button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer p-3 bg-orange-50 rounded-lg hover:bg-orange-100 transition-all flex-1">
            <input type="checkbox" className="checkbox-custom" checked={operation.crea_realisee} onChange={(e) => onUpdate({ crea_realisee: e.target.checked })} />
            <span className="text-sm font-medium">Créa réalisée</span>
          </label>
          {operation.crea_realisee && hasTemplate('crea_realisee') && <button onClick={() => copyMessageToClipboard('crea_realisee', operation)} className="p-2 hover:bg-blue-50 rounded-lg transition-colors">{copiedMessageId === operation.id + 'crea_realisee' ? <Check size={18} className="text-green-600" /> : <Copy size={18} className="text-blue-600" />}</button>}
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer p-3 bg-orange-50 rounded-lg hover:bg-orange-100 transition-all flex-1">
            <input type="checkbox" className="checkbox-custom" checked={operation.bat_envoye_eric} onChange={(e) => onUpdate({ bat_envoye_eric: e.target.checked })} />
            <span className="text-sm font-medium">BAT → Eric</span>
          </label>
          {operation.bat_envoye_eric && hasTemplate('bat_envoye_eric') && <button onClick={() => copyMessageToClipboard('bat_envoye_eric', operation)} className="p-2 hover:bg-blue-50 rounded-lg transition-colors">{copiedMessageId === operation.id + 'bat_envoye_eric' ? <Check size={18} className="text-green-600" /> : <Copy size={18} className="text-blue-600" />}</button>}
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer p-3 bg-orange-50 rounded-lg hover:bg-orange-100 transition-all flex-1">
            <input type="checkbox" className="checkbox-custom" checked={operation.bat_envoye_marketing} onChange={(e) => onUpdate({ bat_envoye_marketing: e.target.checked })} />
            <span className="text-sm font-medium">BAT → Marketing</span>
          </label>
          {operation.bat_envoye_marketing && hasTemplate('bat_envoye_marketing') && <button onClick={() => copyMessageToClipboard('bat_envoye_marketing', operation)} className="p-2 hover:bg-blue-50 rounded-lg transition-colors">{copiedMessageId === operation.id + 'bat_envoye_marketing' ? <Check size={18} className="text-green-600" /> : <Copy size={18} className="text-blue-600" />}</button>}
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer p-3 bg-orange-50 rounded-lg hover:bg-orange-100 transition-all flex-1">
            <input type="checkbox" className="checkbox-custom" checked={operation.bat_valide} onChange={(e) => onUpdate({ bat_valide: e.target.checked })} />
            <span className="text-sm font-medium">BAT validé</span>
          </label>
          {operation.bat_valide && hasTemplate('bat_valide') && <button onClick={() => copyMessageToClipboard('bat_valide', operation)} className="p-2 hover:bg-blue-50 rounded-lg transition-colors">{copiedMessageId === operation.id + 'bat_valide' ? <Check size={18} className="text-green-600" /> : <Copy size={18} className="text-blue-600" />}</button>}
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer p-3 bg-orange-50 rounded-lg hover:bg-orange-100 transition-all flex-1">
            <input type="checkbox" className="checkbox-custom" checked={operation.dans_planning_sre} onChange={(e) => onUpdate({ dans_planning_sre: e.target.checked })} />
            <span className="text-sm font-medium">Planning SRE</span>
          </label>
          {operation.dans_planning_sre && hasTemplate('dans_planning_sre') && <button onClick={() => copyMessageToClipboard('dans_planning_sre', operation)} className="p-2 hover:bg-blue-50 rounded-lg transition-colors">{copiedMessageId === operation.id + 'dans_planning_sre' ? <Check size={18} className="text-green-600" /> : <Copy size={18} className="text-blue-600" />}</button>}
        </div>
      </div>

      {expanded && (
        <div className="mt-6 pt-6 border-t-2 border-orange-100 space-y-4">
          {operation.type === 'email' ? (
            <>
              <div><label className="block text-sm font-semibold text-gray-700 mb-2">Objet</label><input type="text" value={operation.objet || ''} onChange={(e) => onUpdate({ objet: e.target.value })} className="w-full px-4 py-2 border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:outline-none" /></div>
              <div><label className="block text-sm font-semibold text-gray-700 mb-2">Pre-header</label><input type="text" value={operation.preheader || ''} onChange={(e) => onUpdate({ preheader: e.target.value })} className="w-full px-4 py-2 border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:outline-none" /></div>
              <div><label className="block text-sm font-semibold text-gray-700 mb-2">Corps</label><textarea value={operation.corps || ''} onChange={(e) => onUpdate({ corps: e.target.value })} rows="4" className="w-full px-4 py-2 border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:outline-none" /></div>
            </>
          ) : (
            <>
              <div><label className="block text-sm font-semibold text-gray-700 mb-2">Titre slider</label><input type="text" value={operation.titre_slider || ''} onChange={(e) => onUpdate({ titre_slider: e.target.value })} className="w-full px-4 py-2 border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:outline-none" /></div>
              <div><label className="block text-sm font-semibold text-gray-700 mb-2">Sous-titre</label><input type="text" value={operation.sous_titre_slider || ''} onChange={(e) => onUpdate({ sous_titre_slider: e.target.value })} className="w-full px-4 py-2 border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:outline-none" /></div>
              <div><label className="block text-sm font-semibold text-gray-700 mb-2">Texte bouton</label><input type="text" value={operation.texte_bouton || ''} onChange={(e) => onUpdate({ texte_bouton: e.target.value })} className="w-full px-4 py-2 border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:outline-none" /></div>
              <div><label className="block text-sm font-semibold text-gray-700 mb-2">Lien bouton</label><input type="url" value={operation.lien_bouton || ''} onChange={(e) => onUpdate({ lien_bouton: e.target.value })} className="w-full px-4 py-2 border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:outline-none" /></div>
              <div><label className="block text-sm font-semibold text-gray-700 mb-2">URL image</label><input type="url" value={operation.image_url || ''} onChange={(e) => onUpdate({ image_url: e.target.value })} className="w-full px-4 py-2 border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:outline-none" /></div>
              <div><label className="block text-sm font-semibold text-gray-700 mb-2">Position</label><select value={operation.position_slider || 'homepage'} onChange={(e) => onUpdate({ position_slider: e.target.value })} className="w-full px-4 py-2 border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:outline-none"><option value="homepage">Homepage</option><option value="category">Catégorie</option><option value="product">Produit</option><option value="landing">Landing</option></select></div>
            </>
          )}
          <div><label className="block text-sm font-semibold text-gray-700 mb-2">Brief</label><textarea value={operation.brief || ''} onChange={(e) => onUpdate({ brief: e.target.value })} rows="3" className="w-full px-4 py-2 border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:outline-none" /></div>
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-gray-700">Produits</label>
              <button onClick={() => setShowProductModal(true)} className="btn-primary text-sm flex items-center gap-2"><Plus size={16} />Ajouter produit</button>
            </div>
            <div className="space-y-2">
              {(operation.produits || []).map((product, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                  <div className="flex-1">
                    <div className="font-semibold text-gray-800">{product.libelle}</div>
                    {product.url && <a href={product.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1"><ExternalLink size={14} />{product.url}</a>}
                  </div>
                  <button onClick={() => removeProduct(index)} className="p-1 hover:bg-red-100 rounded transition-colors"><X size={16} className="text-red-600" /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {showProductModal && <ProductModal onClose={() => setShowProductModal(false)} onAdd={addProduct} />}
    </div>
  );
};

const ProductModal = ({ onClose, onAdd }) => {
  const [libelle, setLibelle] = useState('');
  const [url, setUrl] = useState('');

  const handleSubmit = () => {
    if (!libelle.trim()) { alert('Libellé requis'); return; }
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) { alert('URL invalide'); return; }
    onAdd({ libelle: libelle.trim(), url: url.trim() });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl p-8 max-w-md w-full m-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold gradient-text mb-6">Ajouter un produit</h2>
        <div className="space-y-4">
          <div><label className="block text-sm font-semibold text-gray-700 mb-2">Libellé *</label><input type="text" value={libelle} onChange={(e) => setLibelle(e.target.value)} className="w-full px-4 py-2 border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:outline-none" placeholder="Ex: Nike Air Max" /></div>
          <div><label className="block text-sm font-semibold text-gray-700 mb-2">URL (optionnel)</label><input type="url" value={url} onChange={(e) => setUrl(e.target.value)} className="w-full px-4 py-2 border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:outline-none" placeholder="https://..." /></div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1">Annuler</button>
          <button onClick={handleSubmit} className="btn-primary flex-1">Ajouter</button>
        </div>
      </div>
    </div>
  );
};

const AddOperationModal = ({ operationType, onClose, onAdd }) => {
  const [formData, setFormData] = useState({ dateEnvoi: '', titre: '', thematique: '', langue: 'FR', brief: '', position_slider: 'homepage' });

  const handleSubmit = () => {
    if (!formData.dateEnvoi || !formData.titre) { alert('Date et titre requis'); return; }
    onAdd(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl p-8 max-w-md w-full m-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold gradient-text mb-6">Nouvelle opération</h2>
        <div className="space-y-4">
          <div><label className="block text-sm font-semibold text-gray-700 mb-2">Date d'envoi *</label><input type="date" value={formData.dateEnvoi} onChange={(e) => setFormData({ ...formData, dateEnvoi: e.target.value })} className="w-full px-4 py-2 border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:outline-none" /></div>
          <div><label className="block text-sm font-semibold text-gray-700 mb-2">Titre *</label><input type="text" value={formData.titre} onChange={(e) => setFormData({ ...formData, titre: e.target.value })} className="w-full px-4 py-2 border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:outline-none" placeholder="Ex: Saint Valentin 2024" /></div>
          <div><label className="block text-sm font-semibold text-gray-700 mb-2">Thématique</label><input type="text" value={formData.thematique} onChange={(e) => setFormData({ ...formData, thematique: e.target.value })} className="w-full px-4 py-2 border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:outline-none" placeholder="Ex: Promotion" /></div>
          <div><label className="block text-sm font-semibold text-gray-700 mb-2">Langue</label><select value={formData.langue} onChange={(e) => setFormData({ ...formData, langue: e.target.value })} className="w-full px-4 py-2 border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:outline-none"><option value="FR">FR</option><option value="EN">EN</option><option value="DE">DE</option><option value="ES">ES</option><option value="IT">IT</option></select></div>
          {operationType === 'slider' && <div><label className="block text-sm font-semibold text-gray-700 mb-2">Position</label><select value={formData.position_slider} onChange={(e) => setFormData({ ...formData, position_slider: e.target.value })} className="w-full px-4 py-2 border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:outline-none"><option value="homepage">Homepage</option><option value="category">Catégorie</option><option value="product">Produit</option><option value="landing">Landing</option></select></div>}
          <div><label className="block text-sm font-semibold text-gray-700 mb-2">Brief</label><textarea value={formData.brief} onChange={(e) => setFormData({ ...formData, brief: e.target.value })} rows="3" className="w-full px-4 py-2 border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:outline-none" /></div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1">Annuler</button>
          <button onClick={handleSubmit} className="btn-primary flex-1">Créer</button>
        </div>
      </div>
    </div>
  );
};

const ImportCSVModal = ({ onClose, onImport }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
    <div className="bg-white rounded-2xl p-8 max-w-md w-full m-4" onClick={(e) => e.stopPropagation()}>
      <h2 className="text-2xl font-bold gradient-text mb-6">Importer CSV</h2>
      <div className="space-y-4">
        <p className="text-sm text-gray-600">Colonnes requises : dateenvoi, titre</p>
        <p className="text-sm text-gray-600">Colonnes optionnelles : thematique, langue, brief</p>
        <input type="file" accept=".csv" onChange={onImport} className="w-full px-4 py-2 border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:outline-none" />
      </div>
      <div className="flex gap-3 mt-6">
        <button onClick={onClose} className="btn-secondary flex-1">Fermer</button>
      </div>
    </div>
  </div>
);

const CampaignsView = ({ entities }) => {
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadCampaigns(); }, [entities]);

  const loadCampaigns = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('campaigns').select('*, entities(name), operations(*)').order('date_debut', { ascending: false });
    if (!handleSupabaseError(error)) setCampaigns(data || []);
    setLoading(false);
  };

  const getCampaignStats = (campaign) => {
    const ops = campaign.operations || [];
    const total = ops.length;
    const validated = ops.filter(op => op.bat_valide).length;
    const percentage = total > 0 ? Math.round((validated / total) * 100) : 0;
    return { total, validated, percentage };
  };

  if (selectedCampaign) {
    return (
      <div className="space-y-6">
        <div className="bg-white/90 rounded-2xl p-6 border-2 border-orange-200">
          <button onClick={() => setSelectedCampaign(null)} className="btn-secondary mb-4">← Retour</button>
          <h2 className="text-3xl font-bold gradient-text mb-4">📂 {selectedCampaign.name}</h2>
          {selectedCampaign.description && <p className="text-gray-600 mb-4">{selectedCampaign.description}</p>}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-orange-50 p-4 rounded-lg"><div className="text-2xl font-bold text-orange-600">{selectedCampaign.operations.length}</div><div className="text-sm text-gray-600">Opérations</div></div>
            <div className="bg-blue-50 p-4 rounded-lg"><div className="text-2xl font-bold text-blue-600">{selectedCampaign.operations.filter(o => o.type === 'email').length}</div><div className="text-sm text-gray-600">Emails</div></div>
            <div className="bg-purple-50 p-4 rounded-lg"><div className="text-2xl font-bold text-purple-600">{selectedCampaign.operations.filter(o => o.type === 'slider').length}</div><div className="text-sm text-gray-600">Sliders</div></div>
          </div>
          <div className="text-sm text-gray-600 mb-6">📅 Du {new Date(selectedCampaign.date_debut).toLocaleDateString('fr-FR')} au {new Date(selectedCampaign.date_fin).toLocaleDateString('fr-FR')}</div>
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-gray-800">Timeline</h3>
            {selectedCampaign.operations.sort((a, b) => new Date(a.date_envoi) - new Date(b.date_envoi)).map(op => (
              <div key={op.id} className="bg-gray-50 p-4 rounded-lg border-2 border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{op.type === 'email' ? '📧' : '🖼️'}</span>
                    <div><div className="font-semibold">{op.titre}</div><div className="text-sm text-gray-600">{new Date(op.date_envoi).toLocaleDateString('fr-FR')} • {op.langue}</div></div>
                  </div>
                  <div className="flex items-center gap-2">
                    {op.crea_realisee && <CheckCircle size={16} className="text-green-600" />}
                    {op.bat_valide && <CheckCircle size={16} className="text-blue-600" />}
                    {op.dans_planning_sre && <CheckCircle size={16} className="text-purple-600" />}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white/90 rounded-2xl p-6 border-2 border-orange-200">
        <h2 className="text-2xl font-bold gradient-text mb-6">📂 Mes Campagnes</h2>
        {loading ? <div className="text-center py-8">Chargement...</div> : campaigns.length === 0 ? <div className="text-center py-8 text-gray-600">Aucune campagne</div> : (
          <div className="space-y-4">
            {campaigns.map(campaign => {
              const stats = getCampaignStats(campaign);
              return (
                <div key={campaign.id} onClick={() => setSelectedCampaign(campaign)} className="p-6 bg-gradient-to-r from-orange-50 to-rose-50 rounded-xl border-2 border-orange-200 hover:border-orange-400 cursor-pointer transition-all card-hover">
                  <div className="flex items-start justify-between mb-4">
                    <div><h3 className="text-xl font-bold text-gray-800 mb-2">{campaign.name}</h3><div className="text-sm text-gray-600">{campaign.entities?.name} • {stats.total} opération(s)</div></div>
                    <div className="text-right"><div className="text-2xl font-bold text-orange-600">{stats.percentage}%</div><div className="text-xs text-gray-600">{stats.validated}/{stats.total} validées</div></div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 mb-3"><div className="bg-gradient-to-r from-orange-500 to-rose-500 h-3 rounded-full transition-all" style={{ width: `${stats.percentage}%` }}></div></div>
                  <div className="flex items-center gap-4 text-sm text-gray-600"><span>📅 {new Date(campaign.date_debut).toLocaleDateString('fr-FR')}</span><span>→</span><span>{new Date(campaign.date_fin).toLocaleDateString('fr-FR')}</span></div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const CalendarView = ({ entities }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [allOperations, setAllOperations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAllOperations(); }, [currentMonth]);

  const loadAllOperations = async () => {
    setLoading(true);
    const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    const { data, error } = await supabase.from('operations').select('*, entities(name)').gte('date_envoi', startOfMonth.toISOString().split('T')[0]).lte('date_envoi', endOfMonth.toISOString().split('T')[0]).order('date_envoi');
    if (!handleSupabaseError(error)) setAllOperations(data || []);
    setLoading(false);
  };

  const getDaysInMonth = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  };

  const getOperationsForDay = (day) => {
    if (!day) return [];
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return allOperations.filter(op => op.date_envoi === dateStr);
  };

  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

  return (
    <div className="space-y-6">
      <div className="bg-white/90 rounded-2xl p-6 border-2 border-orange-200">
        <div className="flex items-center justify-between">
          <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))} className="btn-secondary">← Précédent</button>
          <h2 className="text-2xl font-bold gradient-text">{monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}</h2>
          <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))} className="btn-secondary">Suivant →</button>
        </div>
      </div>
      <div className="bg-white/90 rounded-2xl p-6 border-2 border-orange-200">
        <div className="grid grid-cols-7 gap-2">
          {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => <div key={day} className="text-center font-bold text-gray-700 py-2">{day}</div>)}
          {getDaysInMonth().map((day, index) => {
            const ops = getOperationsForDay(day);
            const hasEmail = ops.some(op => op.type === 'email');
            const hasSlider = ops.some(op => op.type === 'slider');
            return (
              <div key={index} className={`min-h-24 p-2 rounded-lg border-2 ${day ? 'bg-white border-orange-200 hover:border-orange-400 cursor-pointer' : 'bg-gray-50 border-gray-200'}`}>
                {day && (
                  <>
                    <div className="font-semibold text-gray-800 mb-1">{day}</div>
                    {ops.length > 0 && (
                      <div className="space-y-1">
                        {hasEmail && <div className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">📧 {ops.filter(o => o.type === 'email').length}</div>}
                        {hasSlider && <div className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">🖼️ {ops.filter(o => o.type === 'slider').length}</div>}
                        {ops.slice(0, 2).map((op, i) => <div key={i} className="text-xs text-gray-600 truncate">{op.titre.substring(0, 15)}...</div>)}
                        {ops.length > 2 && <div className="text-xs text-gray-500">+{ops.length - 2}</div>}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="bg-white/90 rounded-2xl p-4 border-2 border-orange-200">
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2"><div className="w-4 h-4 bg-blue-100 rounded"></div><span>📧 Emails</span></div>
          <div className="flex items-center gap-2"><div className="w-4 h-4 bg-purple-100 rounded"></div><span>🖼️ Sliders</span></div>
        </div>
      </div>
    </div>
  );
};

const AnalyticsView = ({ entities }) => {
  const [stats, setStats] = useState({ total: 0, emails: 0, sliders: 0, validated: 0, inSRE: 0, campaigns: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStats(); }, [entities]);

  const loadStats = async () => {
    setLoading(true);
    const { data: operations, error: opsError } = await supabase.from('operations').select('*');
    const { data: campaigns, error: campsError } = await supabase.from('campaigns').select('*');
    if (!handleSupabaseError(opsError) && !handleSupabaseError(campsError)) {
      setStats({
        total: operations.length,
        emails: operations.filter(o => o.type === 'email').length,
        sliders: operations.filter(o => o.type === 'slider').length,
        validated: operations.filter(o => o.bat_valide).length,
        inSRE: operations.filter(o => o.dans_planning_sre).length,
        campaigns: campaigns.length
      });
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white/90 rounded-2xl p-6 border-2 border-orange-200">
        <h2 className="text-2xl font-bold gradient-text mb-6">📊 Analytics</h2>
        {loading ? <div className="text-center py-8">Chargement...</div> : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-orange-50 p-6 rounded-lg"><div className="text-3xl font-bold text-orange-600">{stats.total}</div><div className="text-sm text-gray-600">Total opérations</div></div>
            <div className="bg-blue-50 p-6 rounded-lg"><div className="text-3xl font-bold text-blue-600">{stats.emails}</div><div className="text-sm text-gray-600">Emails</div></div>
            <div className="bg-purple-50 p-6 rounded-lg"><div className="text-3xl font-bold text-purple-600">{stats.sliders}</div><div className="text-sm text-gray-600">Sliders</div></div>
            <div className="bg-green-50 p-6 rounded-lg"><div className="text-3xl font-bold text-green-600">{stats.validated}</div><div className="text-sm text-gray-600">BAT validés</div></div>
            <div className="bg-indigo-50 p-6 rounded-lg"><div className="text-3xl font-bold text-indigo-600">{stats.inSRE}</div><div className="text-sm text-gray-600">Dans SRE</div></div>
            <div className="bg-rose-50 p-6 rounded-lg"><div className="text-3xl font-bold text-rose-600">{stats.campaigns}</div><div className="text-sm text-gray-600">Campagnes</div></div>
          </div>
        )}
      </div>
    </div>
  );
};
<style>{`
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700&display=swap');
  
  * {
    font-family: 'Sora', sans-serif;
  }
  
  .card-hover {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .card-hover:hover {
    transform: translateY(-2px);
    box-shadow: 0 20px 25px -5px rgba(251, 146, 60, 0.1), 0 10px 10px -5px rgba(251, 146, 60, 0.04);
  }
  
  .tab-active {
    background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
    color: white;
    box-shadow: 0 10px 15px -3px rgba(249, 115, 22, 0.3);
  }
  
  .checkbox-custom {
    appearance: none;
    width: 20px;
    height: 20px;
    border: 2px solid #fb923c;
    border-radius: 4px;
    cursor: pointer;
    position: relative;
    transition: all 0.2s;
  }
  
  .checkbox-custom:checked {
    background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
    border-color: #ea580c;
  }
  
  .checkbox-custom:checked::after {
    content: '✓';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: white;
    font-size: 14px;
    font-weight: bold;
  }
  
  .gradient-text {
    background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  
  .btn-primary {
    background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.3s;
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  
  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 15px -3px rgba(249, 115, 22, 0.4);
  }
  
  .btn-secondary {
    background: white;
    color: #f97316;
    border: 2px solid #f97316;
    padding: 10px 20px;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.3s;
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  
  .btn-secondary:hover {
    background: #fff7ed;
  }
  
  .sync-indicator {
    animation: sync-pulse 2s ease-in-out infinite;
  }
  
  @keyframes sync-pulse {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.5;
      transform: scale(1.1);
    }
  }
  
  .type-selector {
    display: inline-flex;
    background: white;
    border-radius: 8px;
    padding: 4px;
    border: 2px solid #fed7aa;
  }
  
  .type-option {
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
    font-weight: 600;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .type-option:hover {
    background: #fff7ed;
  }
  
  .type-option.active {
    background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
    color: white;
  }
  
  .alert-badge {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.7;
    }
  }
`}</style>
export default EmailManagementTool;
