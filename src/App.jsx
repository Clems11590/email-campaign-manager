import React, { useState, useEffect } from 'react';
import { Upload, Plus, Calendar as CalendarIcon, Filter, CheckCircle, TrendingUp, X, Trash2, Archive, ArchiveRestore, ExternalLink, Layout, Mail, Copy, Check, FolderOpen, ChevronDown, Facebook, Instagram, Twitter, Linkedin, MessageCircle, Tag } from 'lucide-react';
import { supabase, handleSupabaseError } from './supabaseClient';

const EmailManagementTool = () => {
  // États principaux
  const [activeEntity, setActiveEntity] = useState('J4C');
  const [entities, setEntities] = useState([]);
  const [operations, setOperations] = useState([]);
  const [campaigns, setCampaigns] = useState([]); // NOUVEAU : liste des campagnes
  const [operationType, setOperationType] = useState('email');
  const [messageTemplates, setMessageTemplates] = useState([]);
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showCampaigns, setShowCampaigns] = useState(false);
  const [showArchives, setShowArchives] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState(null);
  const [selectedCampaign, setSelectedCampaign] = useState(null); // NOUVEAU : pour la timeline
  const [expandedOperations, setExpandedOperations] = useState(new Set()); // NOUVEAU : pour garder les opérations ouvertes
  const [showTemplates, setShowTemplates] = useState(false); // NOUVEAU : pour afficher les templates
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

  // NOUVEAU : Charger les campagnes
  const loadCampaigns = async () => {
    const activeEntityData = entities.find(e => e.name === activeEntity);
    if (!activeEntityData) return;
    const { data, error } = await supabase.from('campaigns').select('*').eq('entity_id', activeEntityData.id).eq('archived', false).order('start_date', { ascending: false });
    if (!handleSupabaseError(error)) setCampaigns(data || []);
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
  useEffect(() => { if (entities.length > 0) { loadOperations(); loadMessageTemplates(); loadCampaigns(); } }, [activeEntity, entities, operationType]);

  // Temps réel
  useEffect(() => {
    const activeEntityData = entities.find(e => e.name === activeEntity);
    if (!activeEntityData) return;
    const subscription = supabase.channel('operations-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'operations', filter: `entity_id=eq.${activeEntityData.id}` }, () => { loadOperations(); }).subscribe();
    return () => { subscription.unsubscribe(); };
  }, [activeEntity, entities, operationType]);

  // Générer message avec prise en charge des liens SDLM multi-langues
  const generateMessage = (template, operation) => {
    if (!template || !operation) return '';
    const dateFormatted = new Date(operation.date_envoi).toLocaleDateString('fr-FR');
    
    // Construire les liens SDLM selon la langue (format sans émojis)
    let sdlmLinks = '';
    if (operation.lien_sdlm_fr) sdlmLinks += `FR : ${operation.lien_sdlm_fr}\n`;
    if (operation.lien_sdlm_de) sdlmLinks += `DE : ${operation.lien_sdlm_de}\n`;
    if (operation.lien_sdlm_es) sdlmLinks += `ES : ${operation.lien_sdlm_es}\n`;
    
    // Enlever le dernier saut de ligne
    sdlmLinks = sdlmLinks.trim();
    
    const variables = { 
      '{{titre}}': operation.titre || '', 
      '{{date_envoi}}': dateFormatted, 
      '{{type}}': operation.type === 'email' ? 'Email' : operation.type === 'slider' ? 'Slider' : 'Réseaux sociaux', 
      '{{thematique}}': operation.thematique || '', 
      '{{langue}}': operation.langue || '', 
      '{{entity}}': activeEntity, 
      '{{brief}}': operation.brief || '',
      '{{liens_sdlm}}': sdlmLinks
    };
    let subject = template.subject || '';
    let body = template.body || '';
    Object.keys(variables).forEach(key => { 
      subject = subject.replace(new RegExp(key, 'g'), variables[key]); 
      body = body.replace(new RegExp(key, 'g'), variables[key]); 
    });
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

  // Ajouter opération (MODIFIÉ : inclut campaign_id)
  const addOperation = async (operationData) => {
    const activeEntityData = entities.find(e => e.name === activeEntity);
    if (!activeEntityData) return;
    const baseData = { 
      entity_id: activeEntityData.id, 
      type: operationType, 
      date_envoi: operationData.dateEnvoi, 
      titre: operationData.titre, 
      thematique: operationData.thematique, 
      langue: operationData.langue || 'FR', 
      brief: operationData.brief || '', 
      campaign_id: operationData.campaign_id || null, // NOUVEAU : lien vers campagne
      produits: [], 
      crea_realisee: false, 
      bat_envoye_eric: false, 
      bat_envoye_marketing: false, 
      bat_valide: false, 
      dans_planning_sre: false, 
      archived: false 
    };
    
    if (operationType === 'email') { 
      baseData.objet = ''; 
      baseData.preheader = ''; 
      baseData.corps = '';
      baseData.lien_sdlm_fr = '';
      baseData.lien_sdlm_de = '';
      baseData.lien_sdlm_es = '';
    } 
    else if (operationType === 'slider') { 
      baseData.titre_slider = ''; 
      baseData.sous_titre_slider = ''; 
      baseData.texte_bouton = ''; 
      baseData.lien_bouton = ''; 
      baseData.image_url = ''; 
      baseData.position_slider = operationData.position_slider || 'homepage'; 
    }
    else if (operationType === 'social') {
      baseData.texte_publication = '';
      baseData.lien_publication = '';
      baseData.reseau_social = operationData.reseau_social || 'Facebook';
    }
    
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
            if (operationType === 'social') {
              baseOp.reseau_social = opObj.reseau || 'Facebook';
              baseOp.texte_publication = opObj.texte || '';
              baseOp.lien_publication = opObj.lien || '';
            }
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
    if (window.confirm('⚠️ Supprimer cette opération ?')) {
      const { error } = await supabase.from('operations').delete().eq('id', operationId);
      if (!handleSupabaseError(error)) loadOperations();
    }
  };

  const archiveOperation = async (operationId) => {
    if (window.confirm('📦 Archiver cette opération ?')) {
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

  // NOUVEAU : Obtenir le nom de la campagne
  const getCampaignName = (campaignId) => {
    if (!campaignId) return null;
    const campaign = campaigns.find(c => c.id === campaignId);
    return campaign ? campaign.name : null;
  };

  // NOUVEAU : Toggle expanded state
  const toggleExpanded = (operationId) => {
    setExpandedOperations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(operationId)) {
        newSet.delete(operationId);
      } else {
        newSet.add(operationId);
      }
      return newSet;
    });
  };

  const addEntity = async () => {
    const newEntity = prompt('Nom de la nouvelle entité :');
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
            <button onClick={() => setShowAddModal(true)} style={styles.button}><Plus size={18} />Nouvelle opération</button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ backgroundColor: 'white', borderBottom: '1px solid #E5E7EB', padding: '0 40px' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', gap: '8px', overflowX: 'auto' }}>
          {/* Tabs de type d'opération */}
          {!showCampaigns && !showCalendar && !showAnalytics && !showArchives && entities.find(e => e.name === activeEntity) && (
            <div style={{ display: 'flex', gap: '8px', borderRight: '2px solid #FED7AA', paddingRight: '16px', marginRight: '8px' }}>
              <button onClick={() => setOperationType('email')} style={{ ...styles.tab, ...(operationType === 'email' ? styles.tabActive : {}) }}>📧 Email</button>
              <button onClick={() => setOperationType('slider')} style={{ ...styles.tab, ...(operationType === 'slider' ? styles.tabActive : {}) }}>🖼️ Slider</button>
              <button onClick={() => setOperationType('social')} style={{ ...styles.tab, ...(operationType === 'social' ? styles.tabActive : {}) }}>📱 Réseaux sociaux</button>
            </div>
          )}
          
          {/* Tabs des entités */}
          {entities.map(entity => (
            <button key={entity.id} onClick={() => { setActiveEntity(entity.name); setShowAnalytics(false); setShowCalendar(false); setShowCampaigns(false); setShowArchives(false); }} style={{ ...styles.tab, ...(activeEntity === entity.name && !showAnalytics && !showCalendar && !showCampaigns && !showArchives ? styles.tabActive : {}) }}>{entity.name}</button>
          ))}
          <button onClick={() => { setShowCampaigns(true); setShowAnalytics(false); setShowCalendar(false); setShowArchives(false); }} style={{ ...styles.tab, ...(showCampaigns ? styles.tabActive : {}), display: 'flex', alignItems: 'center', gap: '8px' }}><FolderOpen size={18} />Campagnes</button>
          <button onClick={() => { setShowArchives(true); setShowCampaigns(false); setShowAnalytics(false); setShowCalendar(false); }} style={{ ...styles.tab, ...(showArchives ? styles.tabActive : {}), display: 'flex', alignItems: 'center', gap: '8px' }}><Archive size={18} />Archives</button>
          <button onClick={() => { setShowCalendar(true); setShowAnalytics(false); setShowCampaigns(false); setShowArchives(false); setShowTemplates(false); }} style={{ ...styles.tab, ...(showCalendar ? styles.tabActive : {}), display: 'flex', alignItems: 'center', gap: '8px' }}><CalendarIcon size={18} />Calendrier</button>
          <button onClick={() => { setShowAnalytics(true); setShowCalendar(false); setShowCampaigns(false); setShowArchives(false); setShowTemplates(false); }} style={{ ...styles.tab, ...(showAnalytics ? styles.tabActive : {}), display: 'flex', alignItems: 'center', gap: '8px' }}><TrendingUp size={18} />Analytics</button>
          <button onClick={() => { setShowTemplates(true); setShowAnalytics(false); setShowCalendar(false); setShowCampaigns(false); setShowArchives(false); }} style={{ ...styles.tab, ...(showTemplates ? styles.tabActive : {}), display: 'flex', alignItems: 'center', gap: '8px' }}><Mail size={18} />Templates</button>
          <button onClick={addEntity} style={{ ...styles.tab, fontSize: '20px' }}>+</button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '30px 40px' }}>
        {showCampaigns ? (
          <CampaignsView entities={entities} campaigns={campaigns} loadCampaigns={loadCampaigns} operations={operations} onViewTimeline={setSelectedCampaign} />
        ) : showArchives ? (
          <ArchivesView entities={entities} />
        ) : showCalendar ? (
          <CalendarView entities={entities} onOperationClick={setSelectedOperation} />
        ) : showAnalytics ? (
          <AnalyticsView entities={entities} />
        ) : showTemplates ? (
          <TemplatesView entities={entities} messageTemplates={messageTemplates} loadMessageTemplates={loadMessageTemplates} />
        ) : (
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
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={filters.archives} onChange={(e) => setFilters({ ...filters, archives: e.target.checked })} style={{ width: '18px', height: '18px', accentColor: '#F97316' }} />
                  <span style={{ fontSize: '14px', fontWeight: '500' }}>Archives</span>
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
                <input type="date" placeholder="Date début" value={filters.dateDebut} onChange={(e) => setFilters({ ...filters, dateDebut: e.target.value })} style={{ padding: '10px 14px', border: '1px solid #FED7AA', borderRadius: '8px', fontSize: '14px' }} />
                <input type="date" placeholder="Date fin" value={filters.dateFin} onChange={(e) => setFilters({ ...filters, dateFin: e.target.value })} style={{ padding: '10px 14px', border: '1px solid #FED7AA', borderRadius: '8px', fontSize: '14px' }} />
              </div>
            </div>

            {/* Liste des opérations */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
                <div style={{ fontSize: '18px', color: '#6B7280' }}>Chargement...</div>
              </div>
            ) : getFilteredOperations().length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', backgroundColor: 'white', borderRadius: '12px', border: '2px solid #FED7AA' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
                <div style={{ fontSize: '18px', color: '#6B7280' }}>Aucune opération trouvée</div>
              </div>
            ) : (
              getFilteredOperations().map(operation => (
                <OperationCard 
                  key={operation.id} 
                  operation={operation} 
                  campaignName={getCampaignName(operation.campaign_id)} 
                  expanded={expandedOperations.has(operation.id)}
                  toggleExpanded={() => toggleExpanded(operation.id)}
                  onUpdate={(updates) => updateOperation(operation.id, updates)} 
                  onDelete={() => deleteOperation(operation.id)} 
                  onArchive={() => archiveOperation(operation.id)} 
                  onUnarchive={() => unarchiveOperation(operation.id)} 
                  getAlertStatus={getAlertStatus} 
                  messageTemplates={messageTemplates} 
                  copyMessageToClipboard={copyMessageToClipboard} 
                  copiedMessageId={copiedMessageId} 
                />
              ))
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {showAddModal && <AddOperationModal operationType={operationType} campaigns={campaigns} onClose={() => setShowAddModal(false)} onAdd={addOperation} styles={styles} />}
      {showImportModal && <ImportCSVModal onClose={() => setShowImportModal(false)} onImport={handleCSVImport} styles={styles} />}
      {selectedOperation && <OperationDetailModal operation={selectedOperation} campaignName={getCampaignName(selectedOperation.campaign_id)} onClose={() => setSelectedOperation(null)} styles={styles} />}
      {selectedCampaign && <CampaignTimelineModal campaign={selectedCampaign} operations={operations} onClose={() => setSelectedCampaign(null)} styles={styles} />}
    </div>
  );
};

// Composant de carte d'opération (MODIFIÉ : affiche le badge campagne)
const OperationCard = ({ operation, campaignName, expanded, toggleExpanded, onUpdate, onDelete, onArchive, onUnarchive, getAlertStatus, messageTemplates, copyMessageToClipboard, copiedMessageId }) => {
  const [showProductModal, setShowProductModal] = useState(false);
  const alertStatus = getAlertStatus(operation.date_envoi);
  const hasTemplate = (event) => messageTemplates.some(t => t.trigger_event === event);
  
  const addProduct = (product) => {
    const updatedProducts = [...(operation.produits || []), product];
    onUpdate({ produits: updatedProducts });
    setShowProductModal(false);
  };
  
  const removeProduct = (index) => {
    const updatedProducts = (operation.produits || []).filter((_, i) => i !== index);
    onUpdate({ produits: updatedProducts });
  };

  const getTypeIcon = () => {
    if (operation.type === 'email') return '📧';
    if (operation.type === 'slider') return '🖼️';
    if (operation.type === 'social') return '📱';
    return '📄';
  };

  const getSocialIcon = (reseau) => {
    const icons = {
      'Facebook': '🔵',
      'Instagram': '🟣',
      'TikTok': '⚫',
      'LinkedIn': '🔷',
      'Twitter': '🐦'
    };
    return icons[reseau] || '📱';
  };

  return (
    <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', border: '2px solid #FED7AA', marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: expanded ? '16px' : '0' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '24px' }}>{getTypeIcon()}</span>
            <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#1F2937', margin: 0 }}>{operation.titre}</h3>
            {operation.type === 'social' && operation.reseau_social && (
              <span style={{ fontSize: '16px' }}>{getSocialIcon(operation.reseau_social)}</span>
            )}
            <span style={{ fontSize: '14px', backgroundColor: '#FEF3C7', color: '#92400E', padding: '4px 12px', borderRadius: '12px', fontWeight: '600' }}>{operation.langue}</span>
            {/* NOUVEAU : Badge campagne */}
            {campaignName && (
              <span style={{ fontSize: '14px', backgroundColor: '#E0E7FF', color: '#4338CA', padding: '4px 12px', borderRadius: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Tag size={14} />{campaignName}
              </span>
            )}
            {alertStatus.show && (
              <span style={{ fontSize: '14px', backgroundColor: '#FEE2E2', color: '#991B1B', padding: '4px 12px', borderRadius: '12px', fontWeight: '600' }}>⚠️ J-{alertStatus.days}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '14px', color: '#6B7280' }}>
            <span>📅 {new Date(operation.date_envoi).toLocaleDateString('fr-FR')}</span>
            {operation.thematique && <span>🏷️ {operation.thematique}</span>}
            {operation.type === 'slider' && operation.position_slider && <span>📍 {operation.position_slider}</span>}
            {operation.type === 'social' && operation.reseau_social && <span>🌐 {operation.reseau_social}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {operation.archived ? (
            <button onClick={() => onUnarchive()} style={{ padding: '8px', border: 'none', background: 'none', cursor: 'pointer' }}><ArchiveRestore size={18} color="#10B981" /></button>
          ) : (
            <button onClick={() => onArchive()} style={{ padding: '8px', border: 'none', background: 'none', cursor: 'pointer' }}><Archive size={18} color="#F97316" /></button>
          )}
          <button onClick={() => onDelete()} style={{ padding: '8px', border: 'none', background: 'none', cursor: 'pointer' }}><Trash2 size={18} color="#EF4444" /></button>
          <button onClick={toggleExpanded} style={{ padding: '8px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '18px', color: '#F97316' }}>{expanded ? '▲' : '▼'}</button>
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
              
              {/* Liens SDLM multi-langues */}
              <div style={{ backgroundColor: '#FFF7ED', padding: '16px', borderRadius: '8px', marginTop: '12px' }}>
                <label style={{ display: 'block', fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: '#F97316' }}>🔗 Liens SDLM (Structure du mail)</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>🇫🇷 Lien SDLM FR</label>
                    <input type="url" value={operation.lien_sdlm_fr || ''} onChange={(e) => onUpdate({ lien_sdlm_fr: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '1px solid #FED7AA', borderRadius: '8px', fontSize: '14px' }} placeholder="https://..." />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>🇩🇪 Lien SDLM DE</label>
                    <input type="url" value={operation.lien_sdlm_de || ''} onChange={(e) => onUpdate({ lien_sdlm_de: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '1px solid #FED7AA', borderRadius: '8px', fontSize: '14px' }} placeholder="https://..." />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>🇪🇸 Lien SDLM ES</label>
                    <input type="url" value={operation.lien_sdlm_es || ''} onChange={(e) => onUpdate({ lien_sdlm_es: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '1px solid #FED7AA', borderRadius: '8px', fontSize: '14px' }} placeholder="https://..." />
                  </div>
                </div>
              </div>
            </div>
          ) : operation.type === 'slider' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div><label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Titre slider</label><input type="text" value={operation.titre_slider || ''} onChange={(e) => onUpdate({ titre_slider: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '1px solid #FED7AA', borderRadius: '8px', fontSize: '14px' }} /></div>
              <div><label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Sous-titre</label><input type="text" value={operation.sous_titre_slider || ''} onChange={(e) => onUpdate({ sous_titre_slider: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '1px solid #FED7AA', borderRadius: '8px', fontSize: '14px' }} /></div>
              <div><label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Texte bouton</label><input type="text" value={operation.texte_bouton || ''} onChange={(e) => onUpdate({ texte_bouton: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '1px solid #FED7AA', borderRadius: '8px', fontSize: '14px' }} /></div>
              <div><label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Lien bouton</label><input type="url" value={operation.lien_bouton || ''} onChange={(e) => onUpdate({ lien_bouton: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '1px solid #FED7AA', borderRadius: '8px', fontSize: '14px' }} /></div>
              <div><label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>URL image</label><input type="url" value={operation.image_url || ''} onChange={(e) => onUpdate({ image_url: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '1px solid #FED7AA', borderRadius: '8px', fontSize: '14px' }} /></div>
              <div><label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Position</label><select value={operation.position_slider || 'homepage'} onChange={(e) => onUpdate({ position_slider: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '1px solid #FED7AA', borderRadius: '8px', fontSize: '14px' }}><option value="homepage">Homepage</option><option value="category">Catégorie</option><option value="product">Produit</option><option value="landing">Landing</option></select></div>
            </div>
          ) : operation.type === 'social' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div><label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Réseau social</label><select value={operation.reseau_social || 'Facebook'} onChange={(e) => onUpdate({ reseau_social: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '1px solid #FED7AA', borderRadius: '8px', fontSize: '14px' }}><option value="Facebook">🔵 Facebook</option><option value="Instagram">🟣 Instagram</option><option value="TikTok">⚫ TikTok</option><option value="LinkedIn">🔷 LinkedIn</option><option value="Twitter">🐦 Twitter</option></select></div>
              <div><label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Texte de la publication</label><textarea value={operation.texte_publication || ''} onChange={(e) => onUpdate({ texte_publication: e.target.value })} rows="4" style={{ width: '100%', padding: '10px 14px', border: '1px solid #FED7AA', borderRadius: '8px', fontSize: '14px' }} placeholder="Écrivez le texte de votre publication..." /></div>
              <div><label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Lien de la publication</label><input type="url" value={operation.lien_publication || ''} onChange={(e) => onUpdate({ lien_publication: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '1px solid #FED7AA', borderRadius: '8px', fontSize: '14px' }} placeholder="https://..." /></div>
            </div>
          ) : null}
          
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
      {showProductModal && <ProductModal onClose={() => setShowProductModal(false)} onAdd={addProduct} styles={{ button: { backgroundColor: '#F97316', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }, buttonSecondary: { backgroundColor: 'white', color: '#F97316', border: '2px solid #F97316', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' } }} />}
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

// Modal d'ajout d'opération (MODIFIÉ : inclut le champ campagne)
const AddOperationModal = ({ operationType, campaigns, onClose, onAdd, styles }) => {
  const [formData, setFormData] = useState({ 
    dateEnvoi: '', 
    titre: '', 
    thematique: '', 
    langue: 'FR', 
    brief: '', 
    position_slider: 'homepage', 
    reseau_social: 'Facebook',
    campaign_id: '' // NOUVEAU
  });
  const handleSubmit = () => { if (!formData.dateEnvoi || !formData.titre) { alert('Date et titre requis'); return; } onAdd(formData); };
  
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={onClose}>
      <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', maxWidth: '500px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#F97316', marginBottom: '24px' }}>
          Nouvelle opération {operationType === 'email' ? '📧 Email' : operationType === 'slider' ? '🖼️ Slider' : '📱 Réseaux sociaux'}
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* NOUVEAU : Champ campagne */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
              📁 Campagne (optionnel)
            </label>
            <select 
              value={formData.campaign_id} 
              onChange={(e) => setFormData({ ...formData, campaign_id: e.target.value })} 
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #FED7AA', borderRadius: '8px', fontSize: '14px' }}
            >
              <option value="">Aucune campagne</option>
              {campaigns.map(campaign => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name} ({new Date(campaign.start_date).toLocaleDateString('fr-FR')} - {new Date(campaign.end_date).toLocaleDateString('fr-FR')})
                </option>
              ))}
            </select>
            <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>
              Rattache cette opération à une campagne pour voir toutes les opérations liées ensemble
            </p>
          </div>

          <div><label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Date d'envoi *</label><input type="date" value={formData.dateEnvoi} onChange={(e) => setFormData({ ...formData, dateEnvoi: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '1px solid #FED7AA', borderRadius: '8px', fontSize: '14px' }} /></div>
          <div><label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Titre *</label><input type="text" value={formData.titre} onChange={(e) => setFormData({ ...formData, titre: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '1px solid #FED7AA', borderRadius: '8px', fontSize: '14px' }} placeholder="Ex: Saint Valentin 2024" /></div>
          <div><label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Thématique</label><input type="text" value={formData.thematique} onChange={(e) => setFormData({ ...formData, thematique: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '1px solid #FED7AA', borderRadius: '8px', fontSize: '14px' }} placeholder="Ex: Promotion" /></div>
          <div><label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Langue</label><select value={formData.langue} onChange={(e) => setFormData({ ...formData, langue: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '1px solid #FED7AA', borderRadius: '8px', fontSize: '14px' }}><option value="FR">FR</option><option value="EN">EN</option><option value="DE">DE</option><option value="ES">ES</option><option value="IT">IT</option></select></div>
          {operationType === 'slider' && <div><label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Position</label><select value={formData.position_slider} onChange={(e) => setFormData({ ...formData, position_slider: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '1px solid #FED7AA', borderRadius: '8px', fontSize: '14px' }}><option value="homepage">Homepage</option><option value="category">Catégorie</option><option value="product">Produit</option><option value="landing">Landing</option></select></div>}
          {operationType === 'social' && <div><label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Réseau social</label><select value={formData.reseau_social} onChange={(e) => setFormData({ ...formData, reseau_social: e.target.value })} style={{ width: '100%', padding: '10px 14px', border: '1px solid #FED7AA', borderRadius: '8px', fontSize: '14px' }}><option value="Facebook">🔵 Facebook</option><option value="Instagram">🟣 Instagram</option><option value="TikTok">⚫ TikTok</option><option value="LinkedIn">🔷 LinkedIn</option><option value="Twitter">🐦 Twitter</option></select></div>}
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
        <p style={{ fontSize: '14px', color: '#6B7280' }}>Colonnes optionnelles : thematique, langue, brief, position, reseau</p>
        <input type="file" accept=".csv" onChange={onImport} style={{ padding: '10px 14px', border: '1px solid #FED7AA', borderRadius: '8px', fontSize: '14px' }} />
      </div>
      <button onClick={onClose} style={{ ...styles.buttonSecondary, marginTop: '24px' }}>Fermer</button>
    </div>
  </div>
);

// Popup de détails de l'opération (MODIFIÉ : affiche le nom de la campagne)
const OperationDetailModal = ({ operation, campaignName, onClose, styles }) => {
  const getTypeIcon = () => {
    if (operation.type === 'email') return '📧';
    if (operation.type === 'slider') return '🖼️';
    if (operation.type === 'social') return '📱';
    return '📄';
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={onClose}>
      <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', maxWidth: '700px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '32px' }}>{getTypeIcon()}</span>
          <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#F97316', margin: 0 }}>{operation.titre}</h2>
          {/* NOUVEAU : Affichage de la campagne */}
          {campaignName && (
            <span style={{ fontSize: '16px', backgroundColor: '#E0E7FF', color: '#4338CA', padding: '6px 16px', borderRadius: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Tag size={16} />{campaignName}
            </span>
          )}
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <div style={{ padding: '16px', backgroundColor: '#FFF7ED', borderRadius: '8px' }}>
            <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>Date d'envoi</div>
            <div style={{ fontSize: '16px', fontWeight: '600' }}>📅 {new Date(operation.date_envoi).toLocaleDateString('fr-FR')}</div>
          </div>
          <div style={{ padding: '16px', backgroundColor: '#FFF7ED', borderRadius: '8px' }}>
            <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>Langue</div>
            <div style={{ fontSize: '16px', fontWeight: '600' }}>{operation.langue}</div>
          </div>
          {operation.thematique && (
            <div style={{ padding: '16px', backgroundColor: '#FFF7ED', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>Thématique</div>
              <div style={{ fontSize: '16px', fontWeight: '600' }}>🏷️ {operation.thematique}</div>
            </div>
          )}
          {operation.type === 'social' && operation.reseau_social && (
            <div style={{ padding: '16px', backgroundColor: '#FFF7ED', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>Réseau social</div>
              <div style={{ fontSize: '16px', fontWeight: '600' }}>🌐 {operation.reseau_social}</div>
            </div>
          )}
        </div>

        <div style={{ padding: '16px', backgroundColor: '#F3F4F6', borderRadius: '8px', marginBottom: '24px' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#1F2937' }}>Statut</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {operation.crea_realisee ? <Check size={18} color="#10B981" /> : <X size={18} color="#EF4444" />}
              <span style={{ fontSize: '14px' }}>Créa réalisée</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {operation.bat_envoye_eric ? <Check size={18} color="#10B981" /> : <X size={18} color="#EF4444" />}
              <span style={{ fontSize: '14px' }}>BAT Eric</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {operation.bat_envoye_marketing ? <Check size={18} color="#10B981" /> : <X size={18} color="#EF4444" />}
              <span style={{ fontSize: '14px' }}>BAT Marketing</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {operation.bat_valide ? <Check size={18} color="#10B981" /> : <X size={18} color="#EF4444" />}
              <span style={{ fontSize: '14px' }}>BAT validé</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {operation.dans_planning_sre ? <Check size={18} color="#10B981" /> : <X size={18} color="#EF4444" />}
              <span style={{ fontSize: '14px' }}>Dans planning SRE</span>
            </div>
          </div>
        </div>

        {operation.brief && (
          <div style={{ padding: '16px', backgroundColor: '#F3F4F6', borderRadius: '8px', marginBottom: '24px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#1F2937' }}>Brief</div>
            <div style={{ fontSize: '14px', color: '#6B7280', whiteSpace: 'pre-wrap' }}>{operation.brief}</div>
          </div>
        )}

        {operation.type === 'email' && (
          <>
            {(operation.objet || operation.preheader || operation.corps) && (
              <div style={{ padding: '16px', backgroundColor: '#DBEAFE', borderRadius: '8px', marginBottom: '16px' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#1F2937' }}>📧 Contenu Email</div>
                {operation.objet && <div style={{ marginBottom: '8px' }}><span style={{ fontWeight: '600' }}>Objet:</span> {operation.objet}</div>}
                {operation.preheader && <div style={{ marginBottom: '8px' }}><span style={{ fontWeight: '600' }}>Pre-header:</span> {operation.preheader}</div>}
                {operation.corps && <div style={{ whiteSpace: 'pre-wrap' }}><span style={{ fontWeight: '600' }}>Corps:</span> {operation.corps}</div>}
              </div>
            )}
            
            {(operation.lien_sdlm_fr || operation.lien_sdlm_de || operation.lien_sdlm_es) && (
              <div style={{ padding: '16px', backgroundColor: '#FFF7ED', borderRadius: '8px', marginBottom: '16px' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#F97316' }}>🔗 Liens SDLM</div>
                {operation.lien_sdlm_fr && (
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ fontWeight: '600', marginBottom: '4px' }}>🇫🇷 Français</div>
                    <a href={operation.lien_sdlm_fr} target="_blank" rel="noopener noreferrer" style={{ fontSize: '14px', color: '#3B82F6', wordBreak: 'break-all' }}>{operation.lien_sdlm_fr}</a>
                  </div>
                )}
                {operation.lien_sdlm_de && (
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ fontWeight: '600', marginBottom: '4px' }}>🇩🇪 Allemand</div>
                    <a href={operation.lien_sdlm_de} target="_blank" rel="noopener noreferrer" style={{ fontSize: '14px', color: '#3B82F6', wordBreak: 'break-all' }}>{operation.lien_sdlm_de}</a>
                  </div>
                )}
                {operation.lien_sdlm_es && (
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ fontWeight: '600', marginBottom: '4px' }}>🇪🇸 Espagnol</div>
                    <a href={operation.lien_sdlm_es} target="_blank" rel="noopener noreferrer" style={{ fontSize: '14px', color: '#3B82F6', wordBreak: 'break-all' }}>{operation.lien_sdlm_es}</a>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {operation.type === 'slider' && (
          <div style={{ padding: '16px', backgroundColor: '#F3E8FF', borderRadius: '8px', marginBottom: '16px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#1F2937' }}>🖼️ Contenu Slider</div>
            {operation.titre_slider && <div style={{ marginBottom: '8px' }}><span style={{ fontWeight: '600' }}>Titre:</span> {operation.titre_slider}</div>}
            {operation.sous_titre_slider && <div style={{ marginBottom: '8px' }}><span style={{ fontWeight: '600' }}>Sous-titre:</span> {operation.sous_titre_slider}</div>}
            {operation.texte_bouton && <div style={{ marginBottom: '8px' }}><span style={{ fontWeight: '600' }}>Texte bouton:</span> {operation.texte_bouton}</div>}
            {operation.lien_bouton && <div style={{ marginBottom: '8px' }}><span style={{ fontWeight: '600' }}>Lien:</span> <a href={operation.lien_bouton} target="_blank" rel="noopener noreferrer" style={{ color: '#3B82F6' }}>{operation.lien_bouton}</a></div>}
            {operation.position_slider && <div><span style={{ fontWeight: '600' }}>Position:</span> {operation.position_slider}</div>}
          </div>
        )}

        {operation.type === 'social' && (
          <div style={{ padding: '16px', backgroundColor: '#E0F2FE', borderRadius: '8px', marginBottom: '16px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#1F2937' }}>📱 Publication Réseaux Sociaux</div>
            {operation.reseau_social && <div style={{ marginBottom: '8px' }}><span style={{ fontWeight: '600' }}>Réseau:</span> {operation.reseau_social}</div>}
            {operation.texte_publication && <div style={{ marginBottom: '8px', whiteSpace: 'pre-wrap' }}><span style={{ fontWeight: '600' }}>Texte:</span><br />{operation.texte_publication}</div>}
            {operation.lien_publication && <div><span style={{ fontWeight: '600' }}>Lien:</span> <a href={operation.lien_publication} target="_blank" rel="noopener noreferrer" style={{ color: '#3B82F6', wordBreak: 'break-all' }}>{operation.lien_publication}</a></div>}
          </div>
        )}

        {operation.produits && operation.produits.length > 0 && (
          <div style={{ padding: '16px', backgroundColor: '#F3E8FF', borderRadius: '8px', marginBottom: '16px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#1F2937' }}>🛍️ Produits ({operation.produits.length})</div>
            {operation.produits.map((product, index) => (
              <div key={index} style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: index < operation.produits.length - 1 ? '1px solid #E5E7EB' : 'none' }}>
                <div style={{ fontWeight: '600' }}>{product.libelle}</div>
                {product.url && <a href={product.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: '#3B82F6' }}>{product.url}</a>}
              </div>
            ))}
          </div>
        )}

        <button onClick={onClose} style={{ ...styles.button, width: '100%', justifyContent: 'center' }}>Fermer</button>
      </div>
    </div>
  );
};

// NOUVEAU : Timeline d'une campagne
const CampaignTimelineModal = ({ campaign, operations, onClose, styles }) => {
  // Filtrer les opérations de cette campagne
  const campaignOperations = operations.filter(op => op.campaign_id === campaign.id).sort((a, b) => new Date(a.date_envoi) - new Date(b.date_envoi));
  
  const getTypeIcon = (type) => {
    if (type === 'email') return '📧';
    if (type === 'slider') return '🖼️';
    if (type === 'social') return '📱';
    return '📄';
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={onClose}>
      <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', maxWidth: '900px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#F97316', marginBottom: '8px' }}>📅 Timeline : {campaign.name}</h2>
          <p style={{ fontSize: '14px', color: '#6B7280' }}>
            {new Date(campaign.start_date).toLocaleDateString('fr-FR')} → {new Date(campaign.end_date).toLocaleDateString('fr-FR')}
          </p>
          {campaign.description && (
            <p style={{ fontSize: '14px', color: '#6B7280', marginTop: '8px' }}>{campaign.description}</p>
          )}
        </div>

        {campaignOperations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
            <div style={{ fontSize: '18px', color: '#6B7280' }}>Aucune opération dans cette campagne</div>
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            {/* Ligne de timeline verticale */}
            <div style={{ position: 'absolute', left: '30px', top: '0', bottom: '0', width: '2px', backgroundColor: '#FED7AA' }}></div>
            
            {campaignOperations.map((operation, index) => (
              <div key={operation.id} style={{ position: 'relative', paddingLeft: '70px', paddingBottom: '32px' }}>
                {/* Point de la timeline */}
                <div style={{ position: 'absolute', left: '20px', top: '8px', width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#F97316', border: '3px solid white', boxShadow: '0 0 0 3px #FED7AA', zIndex: 1 }}></div>
                
                {/* Carte d'opération */}
                <div style={{ backgroundColor: 'white', border: '2px solid #FED7AA', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '24px' }}>{getTypeIcon(operation.type)}</span>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontSize: '16px', fontWeight: '700', color: '#1F2937', margin: 0 }}>{operation.titre}</h4>
                      <div style={{ fontSize: '14px', color: '#6B7280', marginTop: '4px' }}>
                        📅 {new Date(operation.date_envoi).toLocaleDateString('fr-FR')} • {operation.langue}
                        {operation.thematique && <> • 🏷️ {operation.thematique}</>}
                      </div>
                    </div>
                  </div>
                  
                  {/* Statuts */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
                    {operation.crea_realisee && <span style={{ fontSize: '12px', backgroundColor: '#DCFCE7', color: '#166534', padding: '4px 8px', borderRadius: '4px' }}>✅ Créa OK</span>}
                    {operation.bat_valide && <span style={{ fontSize: '12px', backgroundColor: '#DCFCE7', color: '#166534', padding: '4px 8px', borderRadius: '4px' }}>✅ BAT validé</span>}
                    {operation.dans_planning_sre && <span style={{ fontSize: '12px', backgroundColor: '#DCFCE7', color: '#166534', padding: '4px 8px', borderRadius: '4px' }}>✅ Dans SRE</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: '24px', padding: '16px', backgroundColor: '#FFF7ED', borderRadius: '8px' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#F97316' }}>📊 Statistiques de la campagne</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#F97316' }}>{campaignOperations.length}</div>
              <div style={{ fontSize: '12px', color: '#6B7280' }}>Opérations total</div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#3B82F6' }}>{campaignOperations.filter(o => o.type === 'email').length}</div>
              <div style={{ fontSize: '12px', color: '#6B7280' }}>📧 Emails</div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#A855F7' }}>{campaignOperations.filter(o => o.type === 'slider').length}</div>
              <div style={{ fontSize: '12px', color: '#6B7280' }}>🖼️ Sliders</div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#0284C7' }}>{campaignOperations.filter(o => o.type === 'social').length}</div>
              <div style={{ fontSize: '12px', color: '#6B7280' }}>📱 Social</div>
            </div>
          </div>
        </div>

        <button onClick={onClose} style={{ ...styles.button, width: '100%', justifyContent: 'center', marginTop: '24px' }}>Fermer</button>
      </div>
    </div>
  );
};

// Vue Campagnes (MODIFIÉ : affiche les opérations liées et le bouton timeline)
const CampaignsView = ({ entities, campaigns, loadCampaigns, operations, onViewTimeline }) => {
  const [loading, setLoading] = useState(false);

  const deleteCampaign = async (campaignId) => {
    if (window.confirm('⚠️ Supprimer cette campagne définitivement ?')) {
      const { error } = await supabase.from('campaigns').delete().eq('id', campaignId);
      if (!handleSupabaseError(error)) loadCampaigns();
    }
  };

  const archiveCampaign = async (campaignId) => {
    if (window.confirm('📦 Archiver cette campagne ?')) {
      const { error } = await supabase.from('campaigns').update({ archived: true, archived_at: new Date().toISOString() }).eq('id', campaignId);
      if (!handleSupabaseError(error)) loadCampaigns();
    }
  };

  // NOUVEAU : Compter les opérations d'une campagne
  const getCampaignOperationsCount = (campaignId) => {
    return operations.filter(op => op.campaign_id === campaignId).length;
  };

  // NOUVEAU : Obtenir le nom de l'entité
  const getEntityName = (entityId) => {
    const entity = entities.find(e => e.id === entityId);
    return entity ? entity.name : 'Inconnue';
  };

  return (
    <div>
      <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', border: '2px solid #FED7AA', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#F97316', marginBottom: '8px' }}>📁 Campagnes</h2>
        <p style={{ fontSize: '14px', color: '#6B7280' }}>Gérez vos campagnes marketing et leurs opérations</p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>Chargement...</div>
      ) : campaigns.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', backgroundColor: 'white', borderRadius: '12px', border: '2px solid #FED7AA' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
          <div style={{ fontSize: '18px', color: '#6B7280' }}>Aucune campagne</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {campaigns.map(campaign => {
            const operationsCount = getCampaignOperationsCount(campaign.id);
            const entityName = getEntityName(campaign.entity_id);
            return (
              <div key={campaign.id} style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', border: '2px solid #FED7AA' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
                      <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#1F2937', margin: 0 }}>{campaign.name}</h3>
                      {/* NOUVEAU : Badge entité */}
                      <span style={{ fontSize: '14px', backgroundColor: '#FEF3C7', color: '#92400E', padding: '4px 12px', borderRadius: '12px', fontWeight: '600' }}>
                        {entityName}
                      </span>
                    </div>
                    <div style={{ fontSize: '14px', color: '#6B7280' }}>
                      📅 {new Date(campaign.start_date).toLocaleDateString('fr-FR')} → {new Date(campaign.end_date).toLocaleDateString('fr-FR')}
                    </div>
                    {campaign.description && <div style={{ fontSize: '14px', color: '#6B7280', marginTop: '8px' }}>{campaign.description}</div>}
                    {/* NOUVEAU : Badge avec nombre d'opérations */}
                    <div style={{ marginTop: '12px' }}>
                      <span style={{ fontSize: '14px', backgroundColor: '#E0E7FF', color: '#4338CA', padding: '6px 12px', borderRadius: '8px', fontWeight: '600' }}>
                        {operationsCount} opération{operationsCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {/* NOUVEAU : Bouton pour voir la timeline */}
                    {operationsCount > 0 && (
                      <button onClick={() => onViewTimeline(campaign)} style={{ padding: '8px 16px', backgroundColor: '#DBEAFE', color: '#1E40AF', border: '2px solid #3B82F6', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <CalendarIcon size={16} />Timeline
                      </button>
                    )}
                    <button onClick={() => archiveCampaign(campaign.id)} style={{ padding: '8px 16px', backgroundColor: '#FFF7ED', color: '#F97316', border: '2px solid #F97316', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Archive size={16} />Archiver
                    </button>
                    <button onClick={() => deleteCampaign(campaign.id)} style={{ padding: '8px 16px', backgroundColor: '#FEE2E2', color: '#DC2626', border: '2px solid #DC2626', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Trash2 size={16} />Supprimer
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Vue Archives (inchangée)
const ArchivesView = ({ entities }) => {
  const [archivedCampaigns, setArchivedCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadArchivedCampaigns(); }, []);

  const loadArchivedCampaigns = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('campaigns').select('*').eq('archived', true).order('archived_at', { ascending: false });
    if (!handleSupabaseError(error)) setArchivedCampaigns(data || []);
    setLoading(false);
  };

  const unarchiveCampaign = async (campaignId) => {
    const { error } = await supabase.from('campaigns').update({ archived: false, archived_at: null }).eq('id', campaignId);
    if (!handleSupabaseError(error)) loadArchivedCampaigns();
  };

  const deleteCampaign = async (campaignId) => {
    if (window.confirm('⚠️ Supprimer définitivement cette campagne archivée ?')) {
      const { error } = await supabase.from('campaigns').delete().eq('id', campaignId);
      if (!handleSupabaseError(error)) loadArchivedCampaigns();
    }
  };

  return (
    <div>
      <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', border: '2px solid #FED7AA', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#F97316', marginBottom: '8px' }}>📦 Archives</h2>
        <p style={{ fontSize: '14px', color: '#6B7280' }}>Campagnes archivées</p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>Chargement...</div>
      ) : archivedCampaigns.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', backgroundColor: 'white', borderRadius: '12px', border: '2px solid #FED7AA' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
          <div style={{ fontSize: '18px', color: '#6B7280' }}>Aucune campagne archivée</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {archivedCampaigns.map(campaign => (
            <div key={campaign.id} style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', border: '2px solid #FED7AA', opacity: 0.8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#1F2937', marginBottom: '8px' }}>{campaign.name}</h3>
                  <div style={{ fontSize: '14px', color: '#6B7280' }}>
                    📅 {new Date(campaign.start_date).toLocaleDateString('fr-FR')} → {new Date(campaign.end_date).toLocaleDateString('fr-FR')}
                  </div>
                  <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '4px' }}>
                    Archivée le {new Date(campaign.archived_at).toLocaleDateString('fr-FR')}
                  </div>
                  {campaign.description && <div style={{ fontSize: '14px', color: '#6B7280', marginTop: '8px' }}>{campaign.description}</div>}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => unarchiveCampaign(campaign.id)} style={{ padding: '8px 16px', backgroundColor: '#DCFCE7', color: '#10B981', border: '2px solid #10B981', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ArchiveRestore size={16} />Restaurer
                  </button>
                  <button onClick={() => deleteCampaign(campaign.id)} style={{ padding: '8px 16px', backgroundColor: '#FEE2E2', color: '#DC2626', border: '2px solid #DC2626', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Trash2 size={16} />Supprimer
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Vue Calendrier (inchangée - le fichier est trop long, je vais le continuer)
const CalendarView = ({ entities, onOperationClick }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [allOperations, setAllOperations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAllOperations(); }, [entities, currentMonth]);

  const loadAllOperations = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('operations').select('*').eq('archived', false).order('date_envoi');
    if (!handleSupabaseError(error)) setAllOperations(data || []);
    setLoading(false);
  };

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
            const hasSocial = ops.some(op => op.type === 'social');
            return (
              <div key={index} style={{ minHeight: '120px', padding: '8px', borderRadius: '8px', border: day ? '2px solid #FED7AA' : '2px solid transparent', backgroundColor: day ? 'white' : '#F9FAFB', cursor: day && ops.length > 0 ? 'pointer' : 'default', transition: 'all 0.2s' }} onClick={() => { if (day && ops.length > 0) onOperationClick(ops[0]); }} onMouseEnter={(e) => { if (day && ops.length > 0) e.currentTarget.style.backgroundColor = '#FFF7ED'; }} onMouseLeave={(e) => { if (day) e.currentTarget.style.backgroundColor = 'white'; }}>
                {day && (
                  <>
                    <div style={{ fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>{day}</div>
                    {ops.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {hasEmail && <div style={{ fontSize: '11px', backgroundColor: '#DBEAFE', color: '#1E40AF', padding: '4px 8px', borderRadius: '4px' }}>📧 {ops.filter(o => o.type === 'email').length}</div>}
                        {hasSlider && <div style={{ fontSize: '11px', backgroundColor: '#F3E8FF', color: '#7C3AED', padding: '4px 8px', borderRadius: '4px' }}>🖼️ {ops.filter(o => o.type === 'slider').length}</div>}
                        {hasSocial && <div style={{ fontSize: '11px', backgroundColor: '#E0F2FE', color: '#0284C7', padding: '4px 8px', borderRadius: '4px' }}>📱 {ops.filter(o => o.type === 'social').length}</div>}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '16px', height: '16px', backgroundColor: '#E0F2FE', borderRadius: '4px' }}></div><span style={{ fontSize: '14px' }}>📱 Réseaux sociaux</span></div>
      </div>
    </div>
  );
};

const AnalyticsView = ({ entities }) => {
  const [stats, setStats] = useState({ total: 0, emails: 0, sliders: 0, social: 0, validated: 0, inSRE: 0, campaigns: 0 });
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
        social: operations.filter(o => o.type === 'social').length,
        validated: operations.filter(o => o.bat_valide).length, 
        inSRE: operations.filter(o => o.dans_planning_sre).length, 
        campaigns: campaigns.length 
      }); 
    } 
    setLoading(false); 
  };

  return (
    <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', border: '2px solid #FED7AA' }}>
      <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#F97316', marginBottom: '32px' }}>📊 Analytics</h2>
      {loading ? <div style={{ textAlign: 'center', padding: '40px' }}>Chargement...</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>
          <div style={{ backgroundColor: '#FFF7ED', padding: '32px', borderRadius: '12px' }}><div style={{ fontSize: '48px', fontWeight: '700', color: '#F97316', marginBottom: '8px' }}>{stats.total}</div><div style={{ fontSize: '16px', color: '#6B7280' }}>Total opérations</div></div>
          <div style={{ backgroundColor: '#DBEAFE', padding: '32px', borderRadius: '12px' }}><div style={{ fontSize: '48px', fontWeight: '700', color: '#3B82F6', marginBottom: '8px' }}>{stats.emails}</div><div style={{ fontSize: '16px', color: '#6B7280' }}>📧 Emails</div></div>
          <div style={{ backgroundColor: '#F3E8FF', padding: '32px', borderRadius: '12px' }}><div style={{ fontSize: '48px', fontWeight: '700', color: '#A855F7', marginBottom: '8px' }}>{stats.sliders}</div><div style={{ fontSize: '16px', color: '#6B7280' }}>🖼️ Sliders</div></div>
          <div style={{ backgroundColor: '#E0F2FE', padding: '32px', borderRadius: '12px' }}><div style={{ fontSize: '48px', fontWeight: '700', color: '#0284C7', marginBottom: '8px' }}>{stats.social}</div><div style={{ fontSize: '16px', color: '#6B7280' }}>📱 Réseaux sociaux</div></div>
          <div style={{ backgroundColor: '#DCFCE7', padding: '32px', borderRadius: '12px' }}><div style={{ fontSize: '48px', fontWeight: '700', color: '#10B981', marginBottom: '8px' }}>{stats.validated}</div><div style={{ fontSize: '16px', color: '#6B7280' }}>✅ BAT validés</div></div>
          <div style={{ backgroundColor: '#E0E7FF', padding: '32px', borderRadius: '12px' }}><div style={{ fontSize: '48px', fontWeight: '700', color: '#6366F1', marginBottom: '8px' }}>{stats.inSRE}</div><div style={{ fontSize: '16px', color: '#6B7280' }}>📋 Dans SRE</div></div>
          <div style={{ backgroundColor: '#FCE7F3', padding: '32px', borderRadius: '12px' }}><div style={{ fontSize: '48px', fontWeight: '700', color: '#EC4899', marginBottom: '8px' }}>{stats.campaigns}</div><div style={{ fontSize: '16px', color: '#6B7280' }}>📁 Campagnes</div></div>
        </div>
      )}
    </div>
  );
};

// Vue Templates
const TemplatesView = ({ entities, messageTemplates, loadMessageTemplates }) => {
  const [activeEntity, setActiveEntity] = useState(entities[0]?.name || '');

  const entityTemplates = messageTemplates.filter(t => {
    const entity = entities.find(e => e.name === activeEntity);
    return entity && t.entity_id === entity.id;
  });

  const batEricTemplate = entityTemplates.find(t => t.trigger_event === 'bat_envoye_eric');
  const batMarketingTemplate = entityTemplates.find(t => t.trigger_event === 'bat_envoye_marketing');

  return (
    <div>
      <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', border: '2px solid #FED7AA', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#F97316', marginBottom: '8px' }}>📧 Templates de mail</h2>
        <p style={{ fontSize: '14px', color: '#6B7280' }}>Templates utilisés pour les messages automatiques</p>
        
        {/* Sélecteur d'entité */}
        <div style={{ marginTop: '20px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Entité</label>
          <select value={activeEntity} onChange={(e) => setActiveEntity(e.target.value)} style={{ padding: '10px 14px', border: '2px solid #FED7AA', borderRadius: '8px', fontSize: '14px', minWidth: '200px' }}>
            {entities.map(entity => (
              <option key={entity.id} value={entity.name}>{entity.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Template BAT Eric */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', border: '2px solid #FED7AA', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <span style={{ fontSize: '24px' }}>📧</span>
          <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#1F2937', margin: 0 }}>BAT → Eric</h3>
          <span style={{ fontSize: '14px', backgroundColor: '#DCFCE7', color: '#166534', padding: '4px 12px', borderRadius: '12px', fontWeight: '600' }}>
            {batEricTemplate ? '✅ Activé' : '❌ Non configuré'}
          </span>
        </div>
        
        {batEricTemplate ? (
          <div style={{ backgroundColor: '#F9FAFB', padding: '16px', borderRadius: '8px' }}>
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>Sujet</div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#1F2937', fontFamily: 'monospace', backgroundColor: 'white', padding: '8px 12px', borderRadius: '4px' }}>
                {batEricTemplate.subject}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>Corps du message</div>
              <pre style={{ fontSize: '14px', color: '#1F2937', fontFamily: 'monospace', backgroundColor: 'white', padding: '12px', borderRadius: '4px', whiteSpace: 'pre-wrap', margin: 0 }}>
                {batEricTemplate.body}
              </pre>
            </div>
            <div style={{ marginTop: '12px', fontSize: '12px', color: '#6B7280' }}>
              💡 Variables disponibles : {'{'}{'{'} titre {'}'}{'}'},  {'{'}{'{'} liens_sdlm {'}'}{'}'},  {'{'}{'{'} date_envoi {'}'}{'}'} 
            </div>
          </div>
        ) : (
          <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#FEF2F2', borderRadius: '8px' }}>
            <div style={{ fontSize: '14px', color: '#991B1B' }}>❌ Template non configuré</div>
            <div style={{ fontSize: '12px', color: '#B91C1C', marginTop: '4px' }}>
              Exécutez le script SQL create-bat-templates.sql pour créer ce template
            </div>
          </div>
        )}
      </div>

      {/* Template BAT Marketing */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', border: '2px solid #FED7AA', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <span style={{ fontSize: '24px' }}>📧</span>
          <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#1F2937', margin: 0 }}>BAT → Marketing</h3>
          <span style={{ fontSize: '14px', backgroundColor: '#DCFCE7', color: '#166534', padding: '4px 12px', borderRadius: '12px', fontWeight: '600' }}>
            {batMarketingTemplate ? '✅ Activé' : '❌ Non configuré'}
          </span>
        </div>
        
        {batMarketingTemplate ? (
          <div style={{ backgroundColor: '#F9FAFB', padding: '16px', borderRadius: '8px' }}>
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>Sujet</div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#1F2937', fontFamily: 'monospace', backgroundColor: 'white', padding: '8px 12px', borderRadius: '4px' }}>
                {batMarketingTemplate.subject}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>Corps du message</div>
              <pre style={{ fontSize: '14px', color: '#1F2937', fontFamily: 'monospace', backgroundColor: 'white', padding: '12px', borderRadius: '4px', whiteSpace: 'pre-wrap', margin: 0 }}>
                {batMarketingTemplate.body}
              </pre>
            </div>
            <div style={{ marginTop: '12px', fontSize: '12px', color: '#6B7280' }}>
              💡 Variables disponibles : {'{'}{'{'} titre {'}'}{'}'},  {'{'}{'{'} liens_sdlm {'}'}{'}'},  {'{'}{'{'} date_envoi {'}'}{'}'} 
            </div>
          </div>
        ) : (
          <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#FEF2F2', borderRadius: '8px' }}>
            <div style={{ fontSize: '14px', color: '#991B1B' }}>❌ Template non configuré</div>
            <div style={{ fontSize: '12px', color: '#B91C1C', marginTop: '4px' }}>
              Exécutez le script SQL create-bat-templates.sql pour créer ce template
            </div>
          </div>
        )}
      </div>

      {/* Exemple de message généré */}
      <div style={{ backgroundColor: '#FFF7ED', borderRadius: '12px', padding: '24px', border: '2px solid #FED7AA' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#F97316', marginBottom: '12px' }}>💡 Exemple de message généré</h3>
        <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '14px', whiteSpace: 'pre-wrap' }}>
          {`Sujet : BAT Email - Black Friday 2024

Bonjour,

Voici le(s) e-mail(s) pour Black Friday 2024

FR : https://example.com/sdlm-fr
DE : https://example.com/sdlm-de
ES : https://example.com/sdlm-es

Date d'envoi : 25/11/2024`}
        </div>
        <div style={{ marginTop: '12px', fontSize: '12px', color: '#6B7280' }}>
          ℹ️ Les variables sont automatiquement remplacées par les vraies valeurs de l'opération
        </div>
      </div>
    </div>
  );
};

export default EmailManagementTool;
