import React, { useState, useEffect } from 'react';
import { Upload, Plus, Calendar as CalendarIcon, Filter, CheckCircle, TrendingUp, X, Trash2, Archive, ArchiveRestore, ExternalLink, Layout, Mail, Copy, Check, FolderOpen, ChevronDown } from 'lucide-react';
import { supabase, handleSupabaseError } from './supabaseClient';

const EmailManagementTool = () => {
  // États principaux
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

  // Styles inline constants
  const styles = {
    body: { backgroundColor: '#FFFAF0', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    header: { backgroundColor: 'white', borderBottom: '1px solid #E5E7EB', padding: '20px 40px' },
    headerTitle: { fontSize: '28px', fontWeight: '700', color: '#F97316', marginBottom: '4px' },
    headerSubtitle: { fontSize: '14px', color: '#6B7280' },
    button: { backgroundColor: '#F97316', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' },
    buttonSecondary: { backgroundColor: 'white', color: '#F97316', border: '2px solid #F97316', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' },
    tab: { padding: '16px 24px', border: 'none', borderRadius: '12px 12px 0 0', cursor: 'pointer', fontWeight: '600', backgroundColor: 'transparent', color: '#6B7280', transition: 'all 0.2s' },
    tabActive: { backgroundColor: '#F97316', color: 'white' },
    card: { backgroundColor: 'white', borderRadius: '12px', padding: '24px', border: '2px solid #FED7AA', marginBottom: '16px' },
    filterCard: { backgroundColor: 'white', borderRadius: '12px', padding: '24px', border: '2px solid #FED7AA', marginBottom: '24px' }
  };

  // Charger les entités
  const loadEntities = async () => {
    const { data, error } = await supabase.from('entities').select('*').order('name');
    if (!handleSupabaseError(error)) {
      setEntities(data || []);
      if (data && data.length > 0 && !activeEntity) setActiveEntity(data[0].name);
    }
  };

  // Charger les opérations
  const loadOperations = async () => {
    if (!activeEntity) return;
    setLoading(true);
    const activeEntityData = entities.find(e => e.name === activeEntity);
    if (!activeEntityData) return;
    const { data, error } = await supabase.from('operations').select('*').eq('entity_id', activeEntityData.id).eq('type', operationType).order('date_envoi', { ascending: true });
    if (!handleSupabaseError(error)) setOperations(data || []);
    setLoading(false);
  };

  // Charger les templates
  const loadMessageTemplates = async () => {
    const activeEntityData = entities.find(e => e.name === activeEntity);
    if (!activeEntityData) return;
    const { data, error } = await supabase.from('message_templates').select('*').eq('entity_id', activeEntityData.id).eq('is_active', true);
    if (!handleSupabaseError(error)) setMessageTemplates(data || []);
  };

  useEffect(() => { loadEntities(); }, []);
  useEffect(() => { if (entities.length > 0) { loadOperations(); loadMessageTemplates(); } }, [activeEntity, entities, operationType]);

  // Temps réel
  useEffect(() => {
    const activeEntityData = entities.find(e => e.name === activeEntity);
    if (!activeEntityData) return;
    const subscription = supabase.channel('operations-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'operations', filter: `entity_id=eq.${activeEntityData.id}` }, () => { loadOperations(); }).subscribe();
    return () => { subscription.unsubscribe(); };
  }, [activeEntity, entities, operationType]);

  // Générer message
  const generateMessage = (template, operation) => {
    if (!template || !operation) return '';
    const dateFormatted = new Date(operation.date_envoi).toLocaleDateString('fr-FR');
    const variables = { '{{titre}}': operation.titre || '', '{{date_envoi}}': dateFormatted, '{{type}}': operation.type === 'email' ? 'Email' : 'Slider', '{{thematique}}': operation.thematique || '', '{{langue}}': operation.langue || '', '{{entity}}': activeEntity, '{{brief}}': operation.brief || '' };
    let subject = template.subject || '';
    let body = template.body || '';
    Object.keys(variables).forEach(key => { subject = subject.replace(new RegExp(key, 'g'), variables[key]); body = body.replace(new RegExp(key, 'g'), variables[key]); });
    return subject ? `Sujet : ${subject}\n\n${body}` : body;
  };

  // Copier message
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

  // Ajouter opération
  const addOperation = async (operationData) => {
    const activeEntityData = entities.find(e => e.name === activeEntity);
    if (!activeEntityData) return;
    const baseData = { entity_id: activeEntityData.id, type: operationType, date_envoi: operationData.dateEnvoi, titre: operationData.titre, thematique: operationData.thematique, langue: operationData.langue || 'FR', brief: operationData.brief || '', produits: [], crea_realisee: false, bat_envoye_eric: false, bat_envoye_marketing: false, bat_valide: false, dans_planning_sre: false, archived: false };
    if (operationType === 'email') { baseData.objet = ''; baseData.preheader = ''; baseData.corps = ''; } 
    else { baseData.titre_slider = ''; baseData.sous_titre_slider = ''; baseData.texte_bouton = ''; baseData.lien_bouton = ''; baseData.image_url = ''; baseData.position_slider = operationData.position_slider || 'homepage'; }
    const { error } = await supabase.from('operations').insert([baseData]);
    if (!handleSupabaseError(error)) { setShowAddModal(false); loadOperations(); }
  };

  // Import CSV
  const handleCSVImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const parseCSVLine = (line) => { const result = []; let current = ''; let inQuotes = false; for (let i = 0; i < line.length; i++) { const char = line[i]; const nextChar = line[i + 1]; if (char === '"') { if (inQuotes && nextChar === '"') { current += '"'; i++; } else { inQuotes = !inQuotes; } } else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; } else { current += char; } } result.push(current.trim()); return result; };
        const lines = text.split(/\r?\n/).filter(line => line.trim());
        if (lines.length < 2) { alert('❌ Fichier vide'); return; }
        const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '').replace(/[éèêë]/g, 'e').replace(/[àâä]/g, 'a'));
        if (!headers.some(h => h.includes('date') || h === 'dateenvoi')) { alert('❌ Colonne date manquante'); return; }
        const activeEntityData = entities.find(e => e.name === activeEntity);
        if (!activeEntityData) return;
        const newOperations = [];
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          const values = parseCSVLine(lines[i]);
          const opObj = {}; headers.forEach((header, index) => { opObj[header] = values[index] || ''; });
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
    if (!filters.archives) filtered = filtered.filter(e => !e.archived); else filtered = filtered.filter(e => e.archived);
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
    <div style={styles.body}>
      {/* Header */}
      <div style={styles.header}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <h1 style={styles.headerTitle}>Email Campaign Manager</h1>
            <p style={styles.headerSubtitle}>Gestion centralisée des campagnes marketing</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => setShowImportModal(true)} style={styles.buttonSecondary}><Upload size={18} />Importer CSV</button>
            <button onClick={() => setShowAddModal(true)} style={styles.button}><Plus size={18} />Nouvel {operationType === 'email' ? 'email' : 'slider'}</button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ backgroundColor: 'white', borderBottom: '1px solid #E5E7EB', padding: '0 40px' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', gap: '8px', overflowX: 'auto' }}>
          {entities.map(entity => (
            <button key={entity.id} onClick={() => { setActiveEntity(entity.name); setShowAnalytics(false); setShowCalendar(false); setShowCampaigns(false); }} style={{ ...styles.tab, ...(activeEntity === entity.name && !showAnalytics && !showCalendar && !showCampaigns ? styles.tabActive : {}) }}>{entity.name}</button>
          ))}
          <button onClick={() => { setShowCampaigns(true); setShowAnalytics(false); setShowCalendar(false); }} style={{ ...styles.tab, ...(showCampaigns ? styles.tabActive : {}), display: 'flex', alignItems: 'center', gap: '8px' }}><FolderOpen size={18} />Campagnes</button>
          <button onClick={() => { setShowCalendar(true); setShowAnalytics(false); setShowCampaigns(false); }} style={{ ...styles.tab, ...(showCalendar ? styles.tabActive : {}), display: 'flex', alignItems: 'center', gap: '8px' }}><CalendarIcon size={18} />Calendrier</button>
          <button onClick={() => { setShowAnalytics(true); setShowCalendar(false); setShowCampaigns(false); }} style={{ ...styles.tab, ...(showAnalytics ? styles.tabActive : {}), display: 'flex', alignItems: 'center', gap: '8px' }}><TrendingUp size={18} />Analytics</button>
          <button onClick={addEntity} style={{ ...styles.tab, fontSize: '20px' }}>+</button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '30px 40px' }}>
        {showCampaigns ? <CampaignsView entities={entities} /> : showCalendar ? <CalendarView entities={entities} /> : showAnalytics ? <AnalyticsView entities={entities} /> : (
          <>
            {/* Filtres */}
            <div style={styles.filterCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                <Filter size={20} color="#F97316" />
                <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#1F2937', margin: 0 }}>Filtres</h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={filters.creaRealisee} onChange={(e) => setFilters({ ...filters, creaRealisee: e.target.checked })} style={{ width: '18px', height: '18px', accentColor: '#F97316' }} />
                  <span style={{ fontSize: '14px', fontWeight: '500' }}>Créa réalisée</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={filters.batValide} onChange={(e) => setFilters({ ...filters, batValide: e.target.checked })} style={{ width: '18px', height: '18px', accentColor: '#F97316' }} />
                  <span style={{ fontSize: '14px', fontWeight: '500' }}>BAT validé</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={filters.dansSRE} onChange={(e) => setFilters({ ...filters, dansSRE: e.target.checked })} style={{ width: '18px', height: '18px', accentColor: '#F97316' }} />
                  <span style={{ fontSize: '14px', fontWeight: '500' }}>Dans planning SRE</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={filters.pasDansSRE} onChange={(e) => setFilters({ ...filters, pasDansSRE: e.target.checked })} style={{ width: '18px', height: '18px', accentColor: '#F97316' }} />
                  <span style={{ fontSize: '14px', fontWeight: '500' }}>Pas dans SRE</span>
                </label>
                <input type="text" placeholder="Thématique..." value={filters.thematique} onChange={(e) => setFilters({ ...filters, thematique: e.target.value })} style={{ padding: '10px 14px', border: '1px solid #FED7AA', borderRadius: '8px', fontSize: '14px' }} />
                <select value={filters.langue} onChange={(e) => setFilters({ ...filters, langue: e.target.value })} style={{ padding: '10px 14px', border: '1px solid #FED7AA', borderRadius: '8px', fontSize: '14px' }}>
                  <option value="">Toutes langues</option>
                  <option value="FR">FR</option>
                  <option value="EN">EN</option>
                  <option value="DE">DE</option>
                  <option value="ES">ES</option>
                  <option value="IT">IT</option>
                </select>
                <input type="date" value={filters.dateDebut} onChange={(e) => setFilters({ ...filters, dateDebut: e.target.value })} style={{ padding: '10px 14px', border: '1px solid #FED7AA', borderRadius: '8px', fontSize: '14px' }} />
                <input type="date" value={filters.dateFin} onChange={(e) => setFilters({ ...filters, dateFin: e.target.value })} style={{ padding: '10px 14px', border: '1px solid #FED7AA', borderRadius: '8px', fontSize: '14px' }} />
              </div>
              <button onClick={() => setFilters({ creaRealisee: false, batValide: false, dansSRE: false, pasDansSRE: false, archives: false, thematique: '', langue: '', dateDebut: '', dateFin: '' })} style={{ marginTop: '16px', color: '#F97316', border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>Réinitialiser les filtres</button>
            </div>

            {/* Liste opérations */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {loading ? (
                <div style={{ ...styles.card, textAlign: 'center', padding: '60px' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
                  <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#1F2937' }}>Chargement...</h3>
                </div>
              ) : getFilteredOperations().length === 0 ? (
                <div style={{ ...styles.card, textAlign: 'center', padding: '60px' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>{operationType === 'email' ? '📧' : '🖼️'}</div>
                  <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#1F2937' }}>Aucun{operationType === 'email' ? ' email' : 'e slider'}</h3>
                </div>
              ) : (
                getFilteredOperations().map(operation => (
                  <OperationCard key={operation.id} operation={operation} onUpdate={(updates) => updateOperation(operation.id, updates)} onDelete={() => deleteOperation(operation.id)} onArchive={() => archiveOperation(operation.id)} onUnarchive={() => unarchiveOperation(operation.id)} alert={getAlertStatus(operation.date_envoi)} messageTemplates={messageTemplates} copyMessageToClipboard={copyMessageToClipboard} copiedMessageId={copiedMessageId} styles={styles} />
                ))
              )}
            </div>
          </>
        )}
      </div>

      {showAddModal && <AddOperationModal operationType={operationType} onClose={() => setShowAddModal(false)} onAdd={addOperation} styles={styles} />}
      {showImportModal && <ImportCSVModal onClose={() => setShowImportModal(false)} onImport={handleCSVImport} styles={styles} />}
    </div>
  );
};

const OperationCard = ({ operation, onUpdate, onDelete, onArchive, onUnarchive, alert, messageTemplates, copyMessageToClipboard, copiedMessageId, styles }) => {
  const [expanded, setExpanded] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const hasTemplate = (triggerEvent) => messageTemplates && messageTemplates.some(t => t.trigger_event === triggerEvent);
  const addProduct = async (product) => { const updatedProducts = [...(operation.produits || []), product]; onUpdate({ produits: updatedProducts }); setShowProductModal(false); };
  const removeProduct = async (index) => { const updatedProducts = (operation.produits || []).filter((_, i) => i !== index); onUpdate({ produits: updatedProducts }); };

  return (
    <div style={styles.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '20px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#1F2937', margin: 0 }}>{operation.titre}</h3>
            {alert.show && <span style={{ backgroundColor: '#FDE047', color: '#78350F', fontSize: '12px', padding: '4px 12px', borderRadius: '999px', fontWeight: '700' }}>À ajouter au planning SRE</span>}
            {operation.archived && <span style={{ backgroundColor: '#D1D5DB', color: '#4B5563', fontSize: '12px', padding: '4px 12px', borderRadius: '999px', fontWeight: '600' }}>Archivé</span>}
          </div>
          <div style={{ display: 'flex', gap: '16px', fontSize: '14px', color: '#6B7280' }}>
            <span>📅 {new Date(operation.date_envoi).toLocaleDateString('fr-FR')}</span>
            {operation.thematique && <span>🏷️ {operation.thematique}</span>}
            <span>🌐 {operation.langue}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {!operation.archived && <button onClick={() => onArchive()} style={{ padding: '8px', border: 'none', background: 'none', cursor: 'pointer' }}><Archive size={18} color="#6B7280" /></button>}
          {operation.archived && <button onClick={() => onUnarchive()} style={{ padding: '8px', border: 'none', background: 'none', cursor: 'pointer' }}><ArchiveRestore size={18} color="#10B981" /></button>}
          <button onClick={() => onDelete()} style={{ padding: '8px', border: 'none', background: 'none', cursor: 'pointer' }}><Trash2 size={18} color="#EF4444" /></button>
          <button onClick={() => setExpanded(!expanded)} style={{ padding: '8px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '18px', color: '#F97316' }}>{expanded ? '▲' : '▼'}</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', backgroundColor: '#FFF7ED', borderRadius: '8px', cursor: 'pointer', flex: 1 }}>
            <input type="checkbox" checked={operation.crea_realisee} onChange={(e) => onUpdate({ crea_realisee: e.target.checked })} style={{ width: '18px', height: '18px', accentColor: '#F97316' }} />
            <span style={{ fontSize: '14px', fontWeight: '500' }}>Créa réalisée</span>
          </label>
          {operation.crea_realisee && hasTemplate('crea_realisee') && <button onClick={() => copyMessageToClipboard('crea_realisee', operation)} style={{ padding: '8px', border: 'none', background: 'none', cursor: 'pointer' }}>{copiedMessageId === operation.id + 'crea_realisee' ? <Check size={18} color="#10B981" /> : <Copy size={18} color="#3B82F6" />}</button>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', backgroundColor: '#FFF7ED', borderRadius: '8px', cursor: 'pointer', flex: 1 }}>
            <input type="checkbox" checked={operation.bat_envoye_eric} onChange={(e) => onUpdate({ bat_envoye_eric: e.target.checked })} style={{ width: '18px', height: '18px', accentColor: '#F97316' }} />
            <span style={{ fontSize: '14px', fontWeight: '500' }}>BAT → Eric</span>
          </label>
          {operation.bat_envoye_eric && hasTemplate('bat_envoye_eric') && <button onClick={() => copyMessageToClipboard('bat_envoye_eric', operation)} style={{ padding: '8px', border: 'none', background: 'none', cursor: 'pointer' }}>{copiedMessageId === operation.id + 'bat_envoye_eric' ? <Check size={18} color="#10B981" /> : <Copy size={18} color="#3B82F6" />}</button>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', backgroundColor: '#FFF7ED', borderRadius: '8px', cursor: 'pointer', flex: 1 }}>
            <input type="checkbox" checked={operation.bat_envoye_marketing} onChange={(e) => onUpdate({ bat_envoye_marketing: e.target.checked })} style={{ width: '18px', height: '18px', accentColor: '#F97316' }} />
            <span style={{ fontSize: '14px', fontWeight: '500' }}>BAT → Marketing</span>
          </label>
          {operation.bat_envoye_marketing && hasTemplate('bat_envoye_marketing') && <button onClick={() => copyMessageToClipboard('bat_envoye_marketing', operation)} style={{ padding: '8px', border: 'none', background: 'none', cursor: 'pointer' }}>{copiedMessageId === operation.id + 'bat_envoye_marketing' ? <Check size={18} color="#10B981" /> : <Copy size={18} color="#3B82F6" />}</button>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', backgroundColor: '#DCFCE7', borderRadius: '8px', cursor: 'pointer', flex: 1 }}>
            <input type="checkbox" checked={operation.bat_valide} onChange={(e) => onUpdate({ bat_valide: e.target.checked })} style={{ width: '18px', height: '18px', accentColor: '#10B981' }} />
            <span style={{ fontSize: '14px', fontWeight: '500' }}>BAT validé</span>
          </label>
          {operation.bat_valide && hasTemplate('bat_valide') && <button onClick={() => copyMessageToClipboard('bat_valide', operation)} style={{ padding: '8px', border: 'none', background: 'none', cursor: 'pointer' }}>{copiedMessageId === operation.id + 'bat_valide' ? <Check size={18} color="#10B981" /> : <Copy size={18} color="#3B82F6" />}</button>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', backgroundColor: '#DCFCE7', borderRadius: '8px', cursor: 'pointer', flex: 1 }}>
            <input type="checkbox" checked={operation.dans_planning_sre} onChange={(e) => onUpdate({ dans_planning_sre: e.target.checked })} style={{ width: '18px', height: '18px', accentColor: '#10B981' }} />
            <span style={{ fontSize: '14px', fontWeight: '500' }}>Dans planning SRE</span>
          </label>
          {operation.dans_planning_sre && hasTemplate('dans_planning_sre') && <button onClick={() => copyMessageToClipboard('dans_planning_sre', operation)} style={{ padding: '8px', border: 'none', background: 'none', cursor: 'pointer' }}>{copiedMessageId === operation.id + 'dans_planning_sre' ? <Check size={18} color="#10B981" /> : <Copy size={18} color="#3B82F6" />}</button>}
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '2px solid #FED7AA' }}>
          {operation.type === 'email' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div><label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Objet</label><input type="text" value={operation.objet || ''} onChange={(e) => onUpdate({ objet: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '1px solid #FED7AA', borderRadius: '8px', fontSize: '14px' }} /></div>
              <div><label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Pre-header</label><input type="text" value={operation.preheader || ''} onChange={(e) => onUpdate({ preheader: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '1px solid #FED7AA', borderRadius: '8px', fontSize: '14px' }} /></div>
              <div><label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Corps</label><textarea value={operation.corps || ''} onChange={(e) => onUpdate({ corps: e.target.value })} rows="4" style={{ width: '100%', padding: '10px 14px', border: '1px solid #FED7AA', borderRadius: '8px', fontSize: '14px' }} /></div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div><label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Titre slider</label><input type="text" value={operation.titre_slider || ''} onChange={(e) => onUpdate({ titre_slider: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '1px solid #FED7AA', borderRadius: '8px', fontSize: '14px' }} /></div>
              <div><label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Sous-titre</label><input type="text" value={operation.sous_titre_slider || ''} onChange={(e) => onUpdate({ sous_titre_slider: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '1px solid #FED7AA', borderRadius: '8px', fontSize: '14px' }} /></div>
              <div><label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Texte bouton</label><input type="text" value={operation.texte_bouton || ''} onChange={(e) => onUpdate({ texte_bouton: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '1px solid #FED7AA', borderRadius: '8px', fontSize: '14px' }} /></div>
              <div><label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Lien bouton</label><input type="url" value={operation.lien_bouton || ''} onChange={(e) => onUpdate({ lien_bouton: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '1px solid #FED7AA', borderRadius: '8px', fontSize: '14px' }} /></div>
              <div><label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>URL image</label><input type="url" value={operation.image_url || ''} onChange={(e) => onUpdate({ image_url: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '1px solid #FED7AA', borderRadius: '8px', fontSize: '14px' }} /></div>
              <div><label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Position</label><select value={operation.position_slider || 'homepage'} onChange={(e) => onUpdate({ position_slider: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '1px solid #FED7AA', borderRadius: '8px', fontSize: '14px' }}><option value="homepage">Homepage</option><option value="category">Catégorie</option><option value="product">Produit</option><option value="landing">Landing</option></select></div>
            </div>
          )}
          <div style={{ marginTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <label style={{ fontSize: '14px', fontWeight: '600' }}>Produits</label>
              <button onClick={() => setShowProductModal(true)} style={{ backgroundColor: '#F97316', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}><Plus size={16} />Ajouter</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(operation.produits || []).map((product, index) => (
                <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: '#F3E8FF', borderRadius: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', color: '#1F2937' }}>{product.libelle}</div>
                    {product.url && <a href={product.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: '#3B82F6', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', marginTop: '4px' }}><ExternalLink size={12} />{product.url}</a>}
                  </div>
                  <button onClick={() => removeProduct(index)} style={{ padding: '4px', border: 'none', background: 'none', cursor: 'pointer' }}><X size={16} color="#EF4444" /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {showProductModal && <ProductModal onClose={() => setShowProductModal(false)} onAdd={addProduct} styles={styles} />}
    </div>
  );
};

const ProductModal = ({ onClose, onAdd, styles }) => {
  const [libelle, setLibelle] = useState('');
  const [url, setUrl] = useState('');
  const handleSubmit = () => { if (!libelle.trim()) { alert('Libellé requis'); return; } if (url && !url.startsWith('http://') && !url.startsWith('https://')) { alert('URL invalide'); return; } onAdd({ libelle: libelle.trim(), url: url.trim() }); };
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={onClose}>
      <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', maxWidth: '500px', width: '100%' }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#F97316', marginBottom: '24px' }}>Ajouter un produit</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div><label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Libellé *</label><input type="text" value={libelle} onChange={(e) => setLibelle(e.target.value)} style={{ width: '100%', padding: '10px 14px', border: '1px solid #FED7AA', borderRadius: '8px', fontSize: '14px' }} placeholder="Ex: Nike Air Max" /></div>
          <div><label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>URL (optionnel)</label><input type="url" value={url} onChange={(e) => setUrl(e.target.value)} style={{ width: '100%', padding: '10px 14px', border: '1px solid #FED7AA', borderRadius: '8px', fontSize: '14px' }} placeholder="https://..." /></div>
        </div>
        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
          <button onClick={onClose} style={styles.buttonSecondary}>Annuler</button>
          <button onClick={handleSubmit} style={styles.button}>Ajouter</button>
        </div>
      </div>
    </div>
  );
};

const AddOperationModal = ({ operationType, onClose, onAdd, styles }) => {
  const [formData, setFormData] = useState({ dateEnvoi: '', titre: '', thematique: '', langue: 'FR', brief: '', position_slider: 'homepage' });
  const handleSubmit = () => { if (!formData.dateEnvoi || !formData.titre) { alert('Date et titre requis'); return; } onAdd(formData); };
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={onClose}>
      <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', maxWidth: '500px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#F97316', marginBottom: '24px' }}>Nouvelle opération</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div><label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Date d'envoi *</label><input type="date" value={formData.dateEnvoi} onChange={(e) => setFormData({ ...formData, dateEnvoi: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '1px solid #FED7AA', borderRadius: '8px', fontSize: '14px' }} /></div>
          <div><label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Titre *</label><input type="text" value={formData.titre} onChange={(e) => setFormData({ ...formData, titre: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '1px solid #FED7AA', borderRadius: '8px', fontSize: '14px' }} placeholder="Ex: Saint Valentin 2024" /></div>
          <div><label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Thématique</label><input type="text" value={formData.thematique} onChange={(e) => setFormData({ ...formData, thematique: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '1px solid #FED7AA', borderRadius: '8px', fontSize: '14px' }} placeholder="Ex: Promotion" /></div>
          <div><label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Langue</label><select value={formData.langue} onChange={(e) => setFormData({ ...formData, langue: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '1px solid #FED7AA', borderRadius: '8px', fontSize: '14px' }}><option value="FR">FR</option><option value="EN">EN</option><option value="DE">DE</option><option value="ES">ES</option><option value="IT">IT</option></select></div>
          {operationType === 'slider' && <div><label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Position</label><select value={formData.position_slider} onChange={(e) => setFormData({ ...formData, position_slider: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '1px solid #FED7AA', borderRadius: '8px', fontSize: '14px' }}><option value="homepage">Homepage</option><option value="category">Catégorie</option><option value="product">Produit</option><option value="landing">Landing</option></select></div>}
          <div><label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Brief</label><textarea value={formData.brief} onChange={(e) => setFormData({ ...formData, brief: e.target.value })} rows="3" style={{ width: '100%', padding: '10px 14px', border: '1px solid #FED7AA', borderRadius: '8px', fontSize: '14px' }} /></div>
        </div>
        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
          <button onClick={onClose} style={styles.buttonSecondary}>Annuler</button>
          <button onClick={handleSubmit} style={styles.button}>Créer</button>
        </div>
      </div>
    </div>
  );
};

const ImportCSVModal = ({ onClose, onImport, styles }) => (
  <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={onClose}>
    <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', maxWidth: '500px', width: '100%' }} onClick={(e) => e.stopPropagation()}>
      <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#F97316', marginBottom: '24px' }}>Importer CSV</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <p style={{ fontSize: '14px', color: '#6B7280' }}>Colonnes requises : dateenvoi, titre</p>
        <p style={{ fontSize: '14px', color: '#6B7280' }}>Colonnes optionnelles : thematique, langue, brief</p>
        <input type="file" accept=".csv" onChange={onImport} style={{ padding: '10px 14px', border: '1px solid #FED7AA', borderRadius: '8px', fontSize: '14px' }} />
      </div>
      <button onClick={onClose} style={{ ...styles.buttonSecondary, width: '100%', marginTop: '24px' }}>Fermer</button>
    </div>
  </div>
);

const CampaignsView = ({ entities }) => {
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { loadCampaigns(); }, [entities]);
  const loadCampaigns = async () => { setLoading(true); const { data, error } = await supabase.from('campaigns').select('*, entities(name), operations(*)').order('date_debut', { ascending: false }); if (!handleSupabaseError(error)) setCampaigns(data || []); setLoading(false); };
  const getCampaignStats = (campaign) => { const ops = campaign.operations || []; const total = ops.length; const validated = ops.filter(op => op.bat_valide).length; const percentage = total > 0 ? Math.round((validated / total) * 100) : 0; return { total, validated, percentage }; };

  if (selectedCampaign) {
    return (
      <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', border: '2px solid #FED7AA' }}>
        <button onClick={() => setSelectedCampaign(null)} style={{ backgroundColor: 'white', color: '#F97316', border: '2px solid #F97316', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', marginBottom: '24px' }}>← Retour</button>
        <h2 style={{ fontSize: '32px', fontWeight: '700', color: '#F97316', marginBottom: '16px' }}>📂 {selectedCampaign.name}</h2>
        {selectedCampaign.description && <p style={{ color: '#6B7280', marginBottom: '24px' }}>{selectedCampaign.description}</p>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
          <div style={{ backgroundColor: '#FFF7ED', padding: '20px', borderRadius: '12px' }}><div style={{ fontSize: '32px', fontWeight: '700', color: '#F97316' }}>{selectedCampaign.operations.length}</div><div style={{ fontSize: '14px', color: '#6B7280' }}>Opérations</div></div>
          <div style={{ backgroundColor: '#DBEAFE', padding: '20px', borderRadius: '12px' }}><div style={{ fontSize: '32px', fontWeight: '700', color: '#3B82F6' }}>{selectedCampaign.operations.filter(o => o.type === 'email').length}</div><div style={{ fontSize: '14px', color: '#6B7280' }}>Emails</div></div>
          <div style={{ backgroundColor: '#F3E8FF', padding: '20px', borderRadius: '12px' }}><div style={{ fontSize: '32px', fontWeight: '700', color: '#A855F7' }}>{selectedCampaign.operations.filter(o => o.type === 'slider').length}</div><div style={{ fontSize: '14px', color: '#6B7280' }}>Sliders</div></div>
        </div>
        <div style={{ fontSize: '14px', color: '#6B7280', marginBottom: '32px' }}>📅 Du {new Date(selectedCampaign.date_debut).toLocaleDateString('fr-FR')} au {new Date(selectedCampaign.date_fin).toLocaleDateString('fr-FR')}</div>
        <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '16px' }}>Timeline</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {selectedCampaign.operations.sort((a, b) => new Date(a.date_envoi) - new Date(b.date_envoi)).map(op => (
            <div key={op.id} style={{ backgroundColor: '#F9FAFB', padding: '16px', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '24px' }}>{op.type === 'email' ? '📧' : '🖼️'}</span>
                  <div><div style={{ fontWeight: '600' }}>{op.titre}</div><div style={{ fontSize: '14px', color: '#6B7280' }}>{new Date(op.date_envoi).toLocaleDateString('fr-FR')} • {op.langue}</div></div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {op.crea_realisee && <CheckCircle size={16} color="#10B981" />}
                  {op.bat_valide && <CheckCircle size={16} color="#3B82F6" />}
                  {op.dans_planning_sre && <CheckCircle size={16} color="#A855F7" />}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', border: '2px solid #FED7AA' }}>
      <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#F97316', marginBottom: '24px' }}>📂 Mes Campagnes</h2>
      {loading ? <div style={{ textAlign: 'center', padding: '40px' }}>Chargement...</div> : campaigns.length === 0 ? <div style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>Aucune campagne</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {campaigns.map(campaign => {
            const stats = getCampaignStats(campaign);
            return (
              <div key={campaign.id} onClick={() => setSelectedCampaign(campaign)} style={{ padding: '24px', background: 'linear-gradient(135deg, #FFF7ED 0%, #FEE2E2 100%)', borderRadius: '12px', border: '2px solid #FED7AA', cursor: 'pointer', transition: 'all 0.2s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
                  <div><h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px' }}>{campaign.name}</h3><div style={{ fontSize: '14px', color: '#6B7280' }}>{campaign.entities?.name} • {stats.total} opération(s)</div></div>
                  <div style={{ textAlign: 'right' }}><div style={{ fontSize: '28px', fontWeight: '700', color: '#F97316' }}>{stats.percentage}%</div><div style={{ fontSize: '12px', color: '#6B7280' }}>{stats.validated}/{stats.total} validées</div></div>
                </div>
                <div style={{ width: '100%', backgroundColor: '#E5E7EB', height: '12px', borderRadius: '999px', marginBottom: '12px' }}><div style={{ background: 'linear-gradient(90deg, #F97316 0%, #EA580C 100%)', height: '12px', borderRadius: '999px', width: `${stats.percentage}%`, transition: 'width 0.3s' }}></div></div>
                <div style={{ display: 'flex', gap: '16px', fontSize: '14px', color: '#6B7280', flexWrap: 'wrap' }}><span>📅 {new Date(campaign.date_debut).toLocaleDateString('fr-FR')}</span><span>→</span><span>{new Date(campaign.date_fin).toLocaleDateString('fr-FR')}</span></div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const CalendarView = ({ entities }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [allOperations, setAllOperations] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { loadAllOperations(); }, [currentMonth]);
  const loadAllOperations = async () => { setLoading(true); const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1); const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0); const { data, error } = await supabase.from('operations').select('*, entities(name)').gte('date_envoi', startOfMonth.toISOString().split('T')[0]).lte('date_envoi', endOfMonth.toISOString().split('T')[0]).order('date_envoi'); if (!handleSupabaseError(error)) setAllOperations(data || []); setLoading(false); };
  const getDaysInMonth = () => { const year = currentMonth.getFullYear(); const month = currentMonth.getMonth(); const firstDay = new Date(year, month, 1).getDay(); const daysInMonth = new Date(year, month + 1, 0).getDate(); const days = []; for (let i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) days.push(null); for (let i = 1; i <= daysInMonth; i++) days.push(i); return days; };
  const getOperationsForDay = (day) => { if (!day) return []; const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; return allOperations.filter(op => op.date_envoi === dateStr); };
  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

  return (
    <div>
      <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', marginBottom: '24px', border: '2px solid #FED7AA', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))} style={{ backgroundColor: 'white', color: '#F97316', border: '2px solid #F97316', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>← Précédent</button>
        <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#F97316' }}>{monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}</h2>
        <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))} style={{ backgroundColor: 'white', color: '#F97316', border: '2px solid #F97316', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>Suivant →</button>
      </div>
      <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', border: '2px solid #FED7AA', overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', minWidth: '800px' }}>
          {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => <div key={day} style={{ textAlign: 'center', fontWeight: '700', padding: '12px', color: '#1F2937' }}>{day}</div>)}
          {getDaysInMonth().map((day, index) => {
            const ops = getOperationsForDay(day);
            const hasEmail = ops.some(op => op.type === 'email');
            const hasSlider = ops.some(op => op.type === 'slider');
            return (
              <div key={index} style={{ minHeight: '100px', padding: '8px', borderRadius: '8px', border: day ? '2px solid #FED7AA' : '2px solid transparent', backgroundColor: day ? 'white' : '#F9FAFB', cursor: day ? 'pointer' : 'default' }}>
                {day && (
                  <>
                    <div style={{ fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>{day}</div>
                    {ops.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {hasEmail && <div style={{ fontSize: '11px', backgroundColor: '#DBEAFE', color: '#1E40AF', padding: '4px 8px', borderRadius: '4px' }}>📧 {ops.filter(o => o.type === 'email').length}</div>}
                        {hasSlider && <div style={{ fontSize: '11px', backgroundColor: '#F3E8FF', color: '#7C3AED', padding: '4px 8px', borderRadius: '4px' }}>🖼️ {ops.filter(o => o.type === 'slider').length}</div>}
                        {ops.slice(0, 2).map((op, i) => <div key={i} style={{ fontSize: '11px', color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{op.titre.substring(0, 15)}...</div>)}
                        {ops.length > 2 && <div style={{ fontSize: '11px', color: '#9CA3AF' }}>+{ops.length - 2}</div>}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '16px', marginTop: '24px', border: '2px solid #FED7AA', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '16px', height: '16px', backgroundColor: '#DBEAFE', borderRadius: '4px' }}></div><span style={{ fontSize: '14px' }}>📧 Emails</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '16px', height: '16px', backgroundColor: '#F3E8FF', borderRadius: '4px' }}></div><span style={{ fontSize: '14px' }}>🖼️ Sliders</span></div>
      </div>
    </div>
  );
};

const AnalyticsView = ({ entities }) => {
  const [stats, setStats] = useState({ total: 0, emails: 0, sliders: 0, validated: 0, inSRE: 0, campaigns: 0 });
  const [loading, setLoading] = useState(true);
  useEffect(() => { loadStats(); }, [entities]);
  const loadStats = async () => { setLoading(true); const { data: operations, error: opsError } = await supabase.from('operations').select('*'); const { data: campaigns, error: campsError } = await supabase.from('campaigns').select('*'); if (!handleSupabaseError(opsError) && !handleSupabaseError(campsError)) { setStats({ total: operations.length, emails: operations.filter(o => o.type === 'email').length, sliders: operations.filter(o => o.type === 'slider').length, validated: operations.filter(o => o.bat_valide).length, inSRE: operations.filter(o => o.dans_planning_sre).length, campaigns: campaigns.length }); } setLoading(false); };

  return (
    <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', border: '2px solid #FED7AA' }}>
      <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#F97316', marginBottom: '32px' }}>📊 Analytics</h2>
      {loading ? <div style={{ textAlign: 'center', padding: '40px' }}>Chargement...</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>
          <div style={{ backgroundColor: '#FFF7ED', padding: '32px', borderRadius: '12px' }}><div style={{ fontSize: '48px', fontWeight: '700', color: '#F97316', marginBottom: '8px' }}>{stats.total}</div><div style={{ fontSize: '16px', color: '#6B7280' }}>Total opérations</div></div>
          <div style={{ backgroundColor: '#DBEAFE', padding: '32px', borderRadius: '12px' }}><div style={{ fontSize: '48px', fontWeight: '700', color: '#3B82F6', marginBottom: '8px' }}>{stats.emails}</div><div style={{ fontSize: '16px', color: '#6B7280' }}>Emails</div></div>
          <div style={{ backgroundColor: '#F3E8FF', padding: '32px', borderRadius: '12px' }}><div style={{ fontSize: '48px', fontWeight: '700', color: '#A855F7', marginBottom: '8px' }}>{stats.sliders}</div><div style={{ fontSize: '16px', color: '#6B7280' }}>Sliders</div></div>
          <div style={{ backgroundColor: '#DCFCE7', padding: '32px', borderRadius: '12px' }}><div style={{ fontSize: '48px', fontWeight: '700', color: '#10B981', marginBottom: '8px' }}>{stats.validated}</div><div style={{ fontSize: '16px', color: '#6B7280' }}>BAT validés</div></div>
          <div style={{ backgroundColor: '#E0E7FF', padding: '32px', borderRadius: '12px' }}><div style={{ fontSize: '48px', fontWeight: '700', color: '#6366F1', marginBottom: '8px' }}>{stats.inSRE}</div><div style={{ fontSize: '16px', color: '#6B7280' }}>Dans SRE</div></div>
          <div style={{ backgroundColor: '#FCE7F3', padding: '32px', borderRadius: '12px' }}><div style={{ fontSize: '48px', fontWeight: '700', color: '#EC4899', marginBottom: '8px' }}>{stats.campaigns}</div><div style={{ fontSize: '16px', color: '#6B7280' }}>Campagnes</div></div>
        </div>
      )}
    </div>
  );
};

export default EmailManagementTool;
