import React, { useState, useEffect } from 'react';
import { Upload, Plus, Search, Calendar, Filter, AlertCircle, CheckCircle, Clock, TrendingUp, Download, X, Trash2, Archive, ArchiveRestore, Link as LinkIcon, ExternalLink } from 'lucide-react';
import { supabase, handleSupabaseError } from './supabaseClient';
import { Copy, Check, MessageSquare, FolderOpen } from 'lucide-react';

const EmailManagementTool = () => {
  // États principaux
  const [messageTemplates, setMessageTemplates] = useState([]);
  const [showCampaigns, setShowCampaigns] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const [activeEntity, setActiveEntity] = useState('J4C');
  const [entities, setEntities] = useState([]);
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
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

  // Charger les entités
  const loadEntities = async () => {
    const { data, error } = await supabase
      .from('entities')
      .select('*')
      .order('name');
    
    if (!handleSupabaseError(error)) {
      setEntities(data || []);
      if (data && data.length > 0 && !activeEntity) {
        setActiveEntity(data[0].name);
      }
    }
  };

  // Charger les emails pour l'entité active
  const loadEmails = async () => {
    if (!activeEntity) return;
    
    setLoading(true);
    const activeEntityData = entities.find(e => e.name === activeEntity);
    if (!activeEntityData) return;

    const { data, error } = await supabase
      .from('emails')
      .select('*')
      .eq('entity_id', activeEntityData.id)
      .order('date_envoi', { ascending: true });
    
    if (!handleSupabaseError(error)) {
      setEmails(data || []);
    }
    setLoading(false);
  };

  // Souscrire aux changements en temps réel
  useEffect(() => {
    loadEntities();
  }, []);

  useEffect(() => {
    if (entities.length > 0) {
      loadEmails();
    }
  }, [activeEntity, entities]);

  // Écouter les changements en temps réel
  useEffect(() => {
    const activeEntityData = entities.find(e => e.name === activeEntity);
    if (!activeEntityData) return;

    const subscription = supabase
      .channel('emails-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'emails',
          filter: `entity_id=eq.${activeEntityData.id}`
        }, 
        () => {
          loadEmails();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [activeEntity, entities]);

  // Charger les templates de messages
const loadMessageTemplates = async () => {
  const activeEntityData = entities.find(e => e.name === activeEntity);
  if (!activeEntityData) return;

  const { data, error } = await supabase
    .from('message_templates')
    .select('*')
    .eq('entity_id', activeEntityData.id)
    .eq('is_active', true);
  
  if (!handleSupabaseError(error)) {
    setMessageTemplates(data || []);
  }
};

// Appeler dans useEffect
useEffect(() => {
  if (entities.length > 0) {
    loadOperations();
    loadMessageTemplates(); // ← NOUVEAU
  }
}, [activeEntity, entities]);

  const generateMessage = (template, operation) => {
  if (!template || !operation) return '';
  
  // Formater la date
  const dateFormatted = new Date(operation.date_envoi).toLocaleDateString('fr-FR');
  
  // Map des variables
  const variables = {
    '{{titre}}': operation.titre || '',
    '{{date_envoi}}': dateFormatted,
    '{{type}}': operation.type === 'email' ? 'Email' : 'Slider',
    '{{thematique}}': operation.thematique || '',
    '{{langue}}': operation.langue || '',
    '{{entity}}': activeEntity,
    '{{brief}}': operation.brief || ''
  };
  
  // Remplacer dans le sujet
  let subject = template.subject || '';
  Object.keys(variables).forEach(key => {
    subject = subject.replace(new RegExp(key, 'g'), variables[key]);
  });
  
  // Remplacer dans le corps
  let body = template.body || '';
  Object.keys(variables).forEach(key => {
    body = body.replace(new RegExp(key, 'g'), variables[key]);
  });
  
  // Retourner le message complet
  return subject ? `Sujet : ${subject}\n\n${body}` : body;
};

const copyMessageToClipboard = async (triggerEvent, operation) => {
  // Trouver le template correspondant
  const template = messageTemplates.find(t => t.trigger_event === triggerEvent);
  if (!template) {
    alert('❌ Aucun template configuré pour cette action');
    return;
  }
  
  // Générer le message
  const message = generateMessage(template, operation);
  
  // Copier dans le presse-papier
  try {
    await navigator.clipboard.writeText(message);
    
    // Sauvegarder dans l'historique
    await supabase
      .from('sent_messages')
      .insert([{
        operation_id: operation.id,
        template_id: template.id,
        subject: template.subject,
        body: message
      }]);
    
    // Feedback visuel
    setCopiedMessageId(operation.id + triggerEvent);
    setTimeout(() => setCopiedMessageId(null), 2000);
    
  } catch (error) {
    alert('❌ Erreur lors de la copie : ' + error.message);
  }
};

  const OperationCard = ({ operation, onUpdate, ... }) => {
  const [expanded, setExpanded] = useState(false);

  // Fonction pour afficher le bouton si template disponible
  const hasTemplate = (triggerEvent) => {
    return messageTemplates.some(t => t.trigger_event === triggerEvent);
  };

  return (
    <div className="...">
      {/* ... header ... */}
      
      {/* Checkboxes avec boutons template */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        
        {/* Créa réalisée */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer p-3 bg-orange-50 rounded-lg hover:bg-orange-100 transition-all flex-1">
            <input
              type="checkbox"
              className="checkbox-custom"
              checked={operation.crea_realisee}
              onChange={(e) => onUpdate({ crea_realisee: e.target.checked })}
            />
            <span className="text-sm font-medium">Créa réalisée</span>
          </label>
          {operation.crea_realisee && hasTemplate('crea_realisee') && (
            <button
              onClick={() => copyMessageToClipboard('crea_realisee', operation)}
              className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
              title="Copier le message"
            >
              {copiedMessageId === operation.id + 'crea_realisee' ? (
                <Check size={18} className="text-green-600" />
              ) : (
                <Copy size={18} className="text-blue-600" />
              )}
            </button>
          )}
        </div>

        {/* BAT envoyé Eric */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer p-3 bg-orange-50 rounded-lg hover:bg-orange-100 transition-all flex-1">
            <input
              type="checkbox"
              className="checkbox-custom"
              checked={operation.bat_envoye_eric}
              onChange={(e) => onUpdate({ bat_envoye_eric: e.target.checked })}
            />
            <span className="text-sm font-medium">BAT → Eric</span>
          </label>
          {operation.bat_envoye_eric && hasTemplate('bat_envoye_eric') && (
            <button
              onClick={() => copyMessageToClipboard('bat_envoye_eric', operation)}
              className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
              title="Copier le message"
            >
              {copiedMessageId === operation.id + 'bat_envoye_eric' ? (
                <Check size={18} className="text-green-600" />
              ) : (
                <Copy size={18} className="text-blue-600" />
              )}
            </button>
          )}
        </div>

        {/* Répétez pour les autres checkboxes */}
        
      </div>
      
      {/* ... reste du composant ... */}
    </div>
  );
};

  // Fonction pour ajouter un email
  const addEmail = async (emailData) => {
    const activeEntityData = entities.find(e => e.name === activeEntity);
    if (!activeEntityData) return;

    const { error } = await supabase
      .from('emails')
      .insert([{
        entity_id: activeEntityData.id,
        date_envoi: emailData.dateEnvoi,
        titre: emailData.titre,
        thematique: emailData.thematique,
        langue: emailData.langue || 'FR',
        brief: emailData.brief || '',
        objet: '',
        preheader: '',
        corps: '',
        produits: [],
        crea_realisee: false,
        bat_envoye_eric: false,
        bat_envoye_marketing: false,
        bat_valide: false,
        dans_planning_sre: false,
        archived: false
      }]);

    if (!handleSupabaseError(error)) {
      setShowAddModal(false);
      loadEmails();
    }
  };

  // Import CSV avec parsing amélioré
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
            
            if (char === '"') {
              if (inQuotes && nextChar === '"') {
                current += '"';
                i++;
              } else {
                inQuotes = !inQuotes;
              }
            } else if (char === ',' && !inQuotes) {
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result;
        };

        const lines = text.split(/\r?\n/).filter(line => line.trim());
        
        if (lines.length < 2) {
          alert('❌ Le fichier CSV est vide ou invalide.');
          return;
        }

        const headers = parseCSVLine(lines[0]).map(h => 
          h.toLowerCase()
            .replace(/\s+/g, '')
            .replace(/[éèêë]/g, 'e')
            .replace(/[àâä]/g, 'a')
        );

        const hasDate = headers.some(h => h.includes('date') || h === 'dateenvoi');
        if (!hasDate) {
          alert('❌ Colonne "date" ou "dateenvoi" manquante dans le CSV.');
          return;
        }

        const activeEntityData = entities.find(e => e.name === activeEntity);
        if (!activeEntityData) return;

        const newEmails = [];
        let importedCount = 0;

        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          
          const values = parseCSVLine(lines[i]);
          const emailObj = {};
          
          headers.forEach((header, index) => {
            emailObj[header] = values[index] || '';
          });

          const dateValue = emailObj.dateenvoi || emailObj.date || emailObj.dateenvoie || 
                           emailObj.datedenvoi || emailObj.senddate;

          if (dateValue && dateValue.trim()) {
            newEmails.push({
              entity_id: activeEntityData.id,
              date_envoi: dateValue.trim(),
              titre: emailObj.titre || emailObj.title || emailObj.nom || 'Sans titre',
              thematique: emailObj.thematique || emailObj.theme || emailObj.type || '',
              langue: emailObj.langue || emailObj.language || emailObj.lang || 'FR',
              brief: emailObj.brief || emailObj.description || emailObj.message || '',
              produits: []
            });
            importedCount++;
          }
        }

        if (newEmails.length === 0) {
          alert('❌ Aucun email valide trouvé dans le CSV.');
          return;
        }

        const { error } = await supabase
          .from('emails')
          .insert(newEmails);

        if (!handleSupabaseError(error)) {
          alert(`✅ Import réussi !\n\n${importedCount} email(s) importé(s)`);
          setShowImportModal(false);
          loadEmails();
        }
        
      } catch (error) {
        console.error('Erreur lors de l\'import CSV:', error);
        alert('❌ Erreur lors de l\'import du CSV.\n\n' + error.message);
      }
    };
    
    reader.readAsText(file, 'UTF-8');
  };

  // Mettre à jour un email
  const updateEmail = async (emailId, updates) => {
    const { error } = await supabase
      .from('emails')
      .update(updates)
      .eq('id', emailId);

    if (!handleSupabaseError(error)) {
      loadEmails();
    }
  };

  // Supprimer un email
  const deleteEmail = async (emailId) => {
    if (window.confirm('⚠️ Êtes-vous sûr de vouloir supprimer cet email ?\n\nCette action est irréversible.')) {
      const { error } = await supabase
        .from('emails')
        .delete()
        .eq('id', emailId);

      if (!handleSupabaseError(error)) {
        loadEmails();
      }
    }
  };

  // Archiver un email
  const archiveEmail = async (emailId) => {
    if (window.confirm('📦 Archiver cet email ?')) {
      const { error } = await supabase
        .from('emails')
        .update({ 
          archived: true, 
          archived_at: new Date().toISOString() 
        })
        .eq('id', emailId);

      if (!handleSupabaseError(error)) {
        loadEmails();
      }
    }
  };

  // Désarchiver un email
  const unarchiveEmail = async (emailId) => {
    const { error } = await supabase
      .from('emails')
      .update({ 
        archived: false, 
        archived_at: null 
      })
      .eq('id', emailId);

    if (!handleSupabaseError(error)) {
      loadEmails();
    }
  };

  // Calculer les alertes
  const getAlertStatus = (dateEnvoi) => {
    const today = new Date();
    const sendDate = new Date(dateEnvoi);
    const diffTime = sendDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 5 && diffDays >= 0) {
      return { show: true, days: diffDays };
    }
    return { show: false };
  };

  // Filtrer les emails
  const getFilteredEmails = () => {
    let filtered = [...emails];

    if (!filters.archives) {
      filtered = filtered.filter(e => !e.archived);
    } else {
      filtered = filtered.filter(e => e.archived);
    }

    if (filters.creaRealisee) {
      filtered = filtered.filter(e => e.crea_realisee);
    }
    if (filters.batValide) {
      filtered = filtered.filter(e => e.bat_valide);
    }
    if (filters.dansSRE) {
      filtered = filtered.filter(e => e.dans_planning_sre);
    }
    if (filters.pasDansSRE) {
      filtered = filtered.filter(e => !e.dans_planning_sre);
    }
    if (filters.thematique) {
      filtered = filtered.filter(e => e.thematique?.toLowerCase().includes(filters.thematique.toLowerCase()));
    }
    if (filters.langue) {
      filtered = filtered.filter(e => e.langue === filters.langue);
    }
    if (filters.dateDebut) {
      filtered = filtered.filter(e => new Date(e.date_envoi) >= new Date(filters.dateDebut));
    }
    if (filters.dateFin) {
      filtered = filtered.filter(e => new Date(e.date_envoi) <= new Date(filters.dateFin));
    }

    return filtered.sort((a, b) => new Date(a.date_envoi) - new Date(b.date_envoi));
  };

  // Ajouter une nouvelle entité
  const addEntity = async () => {
    const newEntity = prompt('Nom de la nouvelle entité :');
    if (newEntity && !entities.find(e => e.name === newEntity)) {
      const { error } = await supabase
        .from('entities')
        .insert([{ name: newEntity }]);
      
      if (!handleSupabaseError(error)) {
        loadEntities();
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700&family=Space+Mono:wght@400;700&display=swap');
        
        * {
          font-family: 'Sora', sans-serif;
        }
        
        .mono {
          font-family: 'Space Mono', monospace;
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
        
        .alert-badge {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: .7;
          }
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
      `}</style>

      {/* Dans les tabs */}
<button
  onClick={() => {
    setShowCampaigns(true);
    setShowAnalytics(false);
    setShowCalendar(false);
  }}
  className={`px-6 py-3 rounded-lg font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${
    showCampaigns ? 'tab-active' : 'bg-white hover:bg-orange-50 text-gray-700'
  }`}
>
  <FolderOpen size={18} />
  Campagnes
</button>

      {/* Header */}
      <div className="bg-white/80 backdrop-blur-lg border-b-2 border-orange-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold gradient-text">Email Campaign Manager</h1>
                <span className="sync-indicator bg-green-500 w-3 h-3 rounded-full" title="Synchronisé en temps réel"></span>
              </div>
              <p className="text-sm text-gray-600 mt-1 mono">Gestion centralisée • Synchronisation temps réel</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowImportModal(true)}
                className="btn-secondary flex items-center gap-2"
              >
                <Upload size={18} />
                Importer CSV
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="btn-primary flex items-center gap-2"
              >
                <Plus size={18} />
                Nouvel email
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-6 pt-6">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {entities.map(entity => (
            <button
              key={entity.id}
              onClick={() => {
                setActiveEntity(entity.name);
                setShowAnalytics(false);
              }}
              className={`px-6 py-3 rounded-lg font-semibold whitespace-nowrap transition-all ${
                activeEntity === entity.name && !showAnalytics
                  ? 'tab-active'
                  : 'bg-white hover:bg-orange-50 text-gray-700'
              }`}
            >
              {entity.name}
            </button>
          ))}
          <button
            onClick={() => setShowAnalytics(true)}
            className={`px-6 py-3 rounded-lg font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${
              showAnalytics
                ? 'tab-active'
                : 'bg-white hover:bg-orange-50 text-gray-700'
            }`}
          >
            <TrendingUp size={18} />
            Analytics
          </button>
          <button
            onClick={addEntity}
            className="px-4 py-3 rounded-lg bg-orange-100 hover:bg-orange-200 text-orange-700 font-semibold"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {!showAnalytics ? (
          <>
            {showCampaigns ? (
  <CampaignsView entities={entities} />
) : showCalendar ? (
  <CalendarView entities={entities} />
) : showAnalytics ? (
  <AnalyticsView entities={entities} />
) : (
  // ... liste normale ...
)}
            {/* Filtres */}
            <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-6 mb-6 border-2 border-orange-200">
              <div className="flex items-center gap-3 mb-4">
                <Filter size={20} className="text-orange-600" />
                <h2 className="text-lg font-bold text-gray-800">Filtres</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="checkbox-custom"
                    checked={filters.creaRealisee}
                    onChange={(e) => setFilters({ ...filters, creaRealisee: e.target.checked })}
                  />
                  <span className="text-sm font-medium">Créa réalisée</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="checkbox-custom"
                    checked={filters.batValide}
                    onChange={(e) => setFilters({ ...filters, batValide: e.target.checked })}
                  />
                  <span className="text-sm font-medium">BAT validé</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="checkbox-custom"
                    checked={filters.dansSRE}
                    onChange={(e) => setFilters({ ...filters, dansSRE: e.target.checked })}
                  />
                  <span className="text-sm font-medium">Dans planning SRE</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="checkbox-custom"
                    checked={filters.pasDansSRE}
                    onChange={(e) => setFilters({ ...filters, pasDansSRE: e.target.checked })}
                  />
                  <span className="text-sm font-medium">Pas dans SRE</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="checkbox-custom"
                    checked={filters.archives}
                    onChange={(e) => setFilters({ ...filters, archives: e.target.checked })}
                  />
                  <span className="text-sm font-medium">📦 Emails archivés</span>
                </label>
                <input
                  type="text"
                  placeholder="Thématique..."
                  className="px-4 py-2 border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:outline-none"
                  value={filters.thematique}
                  onChange={(e) => setFilters({ ...filters, thematique: e.target.value })}
                />
                <select
                  className="px-4 py-2 border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:outline-none"
                  value={filters.langue}
                  onChange={(e) => setFilters({ ...filters, langue: e.target.value })}
                >
                  <option value="">Toutes langues</option>
                  <option value="FR">FR - Français</option>
                  <option value="EN">EN - Anglais</option>
                  <option value="DE">DE - Allemand</option>
                  <option value="ES">ES - Espagnol</option>
                  <option value="IT">IT - Italien</option>
                </select>
                <input
                  type="date"
                  className="px-4 py-2 border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:outline-none"
                  value={filters.dateDebut}
                  onChange={(e) => setFilters({ ...filters, dateDebut: e.target.value })}
                />
                <input
                  type="date"
                  className="px-4 py-2 border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:outline-none"
                  value={filters.dateFin}
                  onChange={(e) => setFilters({ ...filters, dateFin: e.target.value })}
                />
              </div>
              <button
                onClick={() => setFilters({
                  creaRealisee: false,
                  batValide: false,
                  dansSRE: false,
                  pasDansSRE: false,
                  archives: false,
                  thematique: '',
                  langue: '',
                  dateDebut: '',
                  dateFin: ''
                })}
                className="mt-4 text-sm text-orange-600 hover:text-orange-700 font-semibold"
              >
                Réinitialiser les filtres
              </button>
            </div>

            {/* Liste des emails */}
            <div className="space-y-4">
              {loading ? (
                <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-12 text-center border-2 border-orange-200">
                  <div className="text-6xl mb-4">⏳</div>
                  <h3 className="text-xl font-bold text-gray-700 mb-2">Chargement...</h3>
                  <p className="text-gray-600">Récupération des données</p>
                </div>
              ) : getFilteredEmails().length === 0 ? (
                <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-12 text-center border-2 border-orange-200">
                  <div className="text-6xl mb-4">📧</div>
                  <h3 className="text-xl font-bold text-gray-700 mb-2">Aucun email pour le moment</h3>
                  <p className="text-gray-600">Commencez par importer un CSV ou créer un email manuellement</p>
                </div>
              ) : (
                getFilteredEmails().map((email) => (
                  <EmailCard
                    key={email.id}
                    email={email}
                    onUpdate={(updates) => updateEmail(email.id, updates)}
                    onDelete={() => deleteEmail(email.id)}
                    onArchive={() => archiveEmail(email.id)}
                    onUnarchive={() => unarchiveEmail(email.id)}
                    alert={getAlertStatus(email.date_envoi)}
                  />
                ))
              )}
            </div>
          </>
        ) : (
          <AnalyticsView entities={entities} />
        )}
      </div>

      {/* Modal Ajout Email */}
      {showAddModal && (
        <AddEmailModal
          onClose={() => setShowAddModal(false)}
          onAdd={addEmail}
        />
      )}

      {/* Modal Import CSV */}
      {showImportModal && (
        <ImportCSVModal
          onClose={() => setShowImportModal(false)}
          onImport={handleCSVImport}
        />
      )}
    </div>
  );
};

// Composant Card Email avec gestion avancée des produits
const EmailCard = ({ email, onUpdate, onDelete, onArchive, onUnarchive, alert }) => {
  const [expanded, setExpanded] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);

  // Parse produits (JSONB from Supabase)
  const produits = Array.isArray(email.produits) ? email.produits : [];

  const addProduct = (produit) => {
    const updatedProduits = [...produits, produit];
    onUpdate({ produits: updatedProduits });
    setShowProductModal(false);
  };

  const removeProduct = (index) => {
    const updatedProduits = produits.filter((_, i) => i !== index);
    onUpdate({ produits: updatedProduits });
  };

  return (
    <div className={`bg-white/90 backdrop-blur-lg rounded-2xl p-6 border-2 card-hover ${
      email.archived ? 'border-gray-300 opacity-75' : 'border-orange-200'
    }`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h3 className="text-xl font-bold text-gray-800">{email.titre}</h3>
            {email.archived && (
              <span className="bg-gray-200 text-gray-700 text-xs px-3 py-1 rounded-full font-semibold flex items-center gap-1">
                <Archive size={12} />
                Archivé
              </span>
            )}
            {!email.archived && alert.show && (
              <span className="alert-badge bg-red-500 text-white text-xs px-3 py-1 rounded-full font-semibold flex items-center gap-1">
                <AlertCircle size={14} />
                J-{alert.days}
              </span>
            )}
            {!email.archived && !email.dans_planning_sre && (
              <span className="bg-yellow-100 text-yellow-700 text-xs px-3 py-1 rounded-full font-semibold">
                À ajouter au planning SRE
              </span>
            )}
            {!email.archived && email.bat_valide && !email.date_validation_bat && (
              <span className="bg-blue-100 text-blue-700 text-xs px-3 py-1 rounded-full font-semibold">
                À mettre dans le planning SRE – BAT validé
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-600 flex-wrap">
            <span className="flex items-center gap-1 mono">
              <Calendar size={14} />
              {new Date(email.date_envoi).toLocaleDateString('fr-FR')}
            </span>
            {email.thematique && (
              <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-semibold">
                {email.thematique}
              </span>
            )}
            <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-semibold mono">
              {email.langue}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {email.archived ? (
            <button
              onClick={onUnarchive}
              className="p-2 hover:bg-green-50 rounded-lg transition-colors group"
              title="Désarchiver"
            >
              <ArchiveRestore size={20} className="text-green-600 group-hover:text-green-700" />
            </button>
          ) : (
            <button
              onClick={onArchive}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors group"
              title="Archiver"
            >
              <Archive size={20} className="text-gray-600 group-hover:text-gray-700" />
            </button>
          )}
          <button
            onClick={onDelete}
            className="p-2 hover:bg-red-50 rounded-lg transition-colors group"
            title="Supprimer définitivement"
          >
            <Trash2 size={20} className="text-red-600 group-hover:text-red-700" />
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-orange-600 hover:text-orange-700 font-semibold text-sm ml-2"
          >
            {expanded ? 'Réduire' : 'Développer'}
          </button>
        </div>
      </div>

      {/* Checkboxes de suivi */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <label className="flex items-center gap-2 cursor-pointer p-3 bg-orange-50 rounded-lg hover:bg-orange-100 transition-all">
          <input
            type="checkbox"
            className="checkbox-custom"
            checked={email.crea_realisee}
            onChange={(e) => onUpdate({ crea_realisee: e.target.checked })}
          />
          <span className="text-sm font-medium">Créa réalisée</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer p-3 bg-orange-50 rounded-lg hover:bg-orange-100 transition-all">
          <input
            type="checkbox"
            className="checkbox-custom"
            checked={email.bat_envoye_eric}
            onChange={(e) => onUpdate({ bat_envoye_eric: e.target.checked })}
          />
          <span className="text-sm font-medium">BAT → Eric</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer p-3 bg-orange-50 rounded-lg hover:bg-orange-100 transition-all">
          <input
            type="checkbox"
            className="checkbox-custom"
            checked={email.bat_envoye_marketing}
            onChange={(e) => onUpdate({ bat_envoye_marketing: e.target.checked })}
          />
          <span className="text-sm font-medium">BAT → Marketing</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer p-3 bg-orange-50 rounded-lg hover:bg-orange-100 transition-all">
          <input
            type="checkbox"
            className="checkbox-custom"
            checked={email.bat_valide}
            onChange={(e) => onUpdate({ bat_valide: e.target.checked })}
          />
          <span className="text-sm font-medium">BAT validé</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer p-3 bg-green-50 rounded-lg hover:bg-green-100 transition-all">
          <input
            type="checkbox"
            className="checkbox-custom"
            checked={email.dans_planning_sre}
            onChange={(e) => onUpdate({
              dans_planning_sre: e.target.checked,
              date_ajout_sre: e.target.checked ? new Date().toISOString() : null
            })}
          />
          <span className="text-sm font-medium">Dans planning SRE</span>
        </label>
      </div>

      {/* Date de validation BAT */}
      {email.bat_valide && (
        <div className="mb-4 p-4 bg-blue-50 rounded-lg">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Date de validation totale du BAT
          </label>
          <input
            type="date"
            className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:border-blue-500 focus:outline-none"
            value={email.date_validation_bat || ''}
            onChange={(e) => onUpdate({ date_validation_bat: e.target.value })}
          />
        </div>
      )}

      {/* Contenu détaillé (développable) */}
      {expanded && (
        <div className="mt-6 pt-6 border-t-2 border-orange-200 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Brief</label>
            <textarea
              className="w-full px-4 py-3 border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:outline-none"
              rows={2}
              value={email.brief || ''}
              onChange={(e) => onUpdate({ brief: e.target.value })}
              placeholder="Description du brief..."
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Objet</label>
            <input
              type="text"
              className="w-full px-4 py-3 border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:outline-none"
              value={email.objet || ''}
              onChange={(e) => onUpdate({ objet: e.target.value })}
              placeholder="Objet de l'email..."
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Pre-header</label>
            <input
              type="text"
              className="w-full px-4 py-3 border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:outline-none"
              value={email.preheader || ''}
              onChange={(e) => onUpdate({ preheader: e.target.value })}
              placeholder="Pre-header..."
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Corps du message</label>
            <textarea
              className="w-full px-4 py-3 border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:outline-none"
              rows={4}
              value={email.corps || ''}
              onChange={(e) => onUpdate({ corps: e.target.value })}
              placeholder="Contenu de l'email..."
            />
          </div>
          
          {/* Gestion des produits avec libellés et URLs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-gray-700">
                Produits à intégrer
              </label>
              <button
                onClick={() => setShowProductModal(true)}
                className="btn-primary text-sm flex items-center gap-1 px-3 py-1"
              >
                <Plus size={16} />
                Ajouter produit
              </button>
            </div>
            
            {produits.length === 0 ? (
              <div className="p-4 bg-gray-50 rounded-lg text-center text-sm text-gray-600">
                Aucun produit ajouté. Cliquez sur "Ajouter produit" pour commencer.
              </div>
            ) : (
              <div className="space-y-2">
                {produits.map((produit, index) => (
                  <div 
                    key={index}
                    className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border-2 border-purple-200"
                  >
                    <div className="flex-1">
                      <div className="font-semibold text-gray-800">{produit.libelle}</div>
                      {produit.url && (
                        <a 
                          href={produit.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 mt-1"
                        >
                          <LinkIcon size={12} />
                          {produit.url}
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                    <button
                      onClick={() => removeProduct(index)}
                      className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                      title="Retirer ce produit"
                    >
                      <X size={16} className="text-red-600" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Ajout Produit */}
      {showProductModal && (
        <ProductModal
          onClose={() => setShowProductModal(false)}
          onAdd={addProduct}
        />
      )}
    </div>
  );
};

// Modal pour ajouter un produit
const ProductModal = ({ onClose, onAdd }) => {
  const [formData, setFormData] = useState({
    libelle: '',
    url: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.libelle.trim()) {
      onAdd(formData);
      setFormData({ libelle: '', url: '' });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-lg w-full border-4 border-purple-300">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800">Ajouter un produit</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Libellé du produit <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              className="w-full px-4 py-3 border-2 border-purple-200 rounded-lg focus:border-purple-500 focus:outline-none"
              value={formData.libelle}
              onChange={(e) => setFormData({ ...formData, libelle: e.target.value })}
              placeholder="Ex: Chaussures running Nike Air"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              URL du produit (optionnel)
            </label>
            <input
              type="url"
              className="w-full px-4 py-3 border-2 border-purple-200 rounded-lg focus:border-purple-500 focus:outline-none"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              placeholder="https://example.com/produit"
            />
            <p className="text-xs text-gray-500 mt-1">
              L'URL doit commencer par http:// ou https://
            </p>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Annuler
            </button>
            <button type="submit" className="btn-primary flex-1">
              Ajouter
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Modal Ajout Email
const AddEmailModal = ({ onClose, onAdd }) => {
  const [formData, setFormData] = useState({
    dateEnvoi: '',
    titre: '',
    thematique: '',
    langue: 'FR',
    brief: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.dateEnvoi && formData.titre) {
      onAdd(formData);
      setFormData({ dateEnvoi: '', titre: '', thematique: '', langue: 'FR', brief: '' });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-8 max-w-2xl w-full border-4 border-orange-300 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold gradient-text">Nouvel email</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Date d'envoi <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              className="w-full px-4 py-3 border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:outline-none"
              value={formData.dateEnvoi}
              onChange={(e) => setFormData({ ...formData, dateEnvoi: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Titre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              className="w-full px-4 py-3 border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:outline-none"
              value={formData.titre}
              onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
              placeholder="Titre de l'email..."
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Thématique</label>
            <input
              type="text"
              className="w-full px-4 py-3 border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:outline-none"
              value={formData.thematique}
              onChange={(e) => setFormData({ ...formData, thematique: e.target.value })}
              placeholder="Ex: vente flash, nouveauté, relance..."
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Langue</label>
            <select
              className="w-full px-4 py-3 border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:outline-none"
              value={formData.langue}
              onChange={(e) => setFormData({ ...formData, langue: e.target.value })}
            >
              <option value="FR">FR - Français</option>
              <option value="EN">EN - Anglais</option>
              <option value="DE">DE - Allemand</option>
              <option value="ES">ES - Espagnol</option>
              <option value="IT">IT - Italien</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Brief</label>
            <textarea
              className="w-full px-4 py-3 border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:outline-none"
              rows={3}
              value={formData.brief}
              onChange={(e) => setFormData({ ...formData, brief: e.target.value })}
              placeholder="Description du message..."
            />
          </div>
          <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
            <p className="text-sm font-semibold text-yellow-800">
              ⚠️ À ajouter dans le planning SRE
            </p>
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Annuler
            </button>
            <button type="submit" className="btn-primary flex-1">
              Créer l'email
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Modal Import CSV
const ImportCSVModal = ({ onClose, onImport }) => {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-8 max-w-3xl w-full border-4 border-orange-300 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold gradient-text">Importer un fichier CSV</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>
        
        <div className="mb-6 space-y-4">
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
            <h3 className="font-bold text-blue-900 mb-2">📋 Format attendu</h3>
            <p className="text-sm text-blue-800 mb-2">
              Votre CSV doit contenir ces colonnes :
            </p>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li><strong>dateenvoi</strong> (obligatoire) - Format : YYYY-MM-DD</li>
              <li><strong>titre</strong> (recommandé)</li>
              <li><strong>thematique, langue, brief</strong> (optionnels)</li>
            </ul>
          </div>

          <div className="border-2 border-dashed border-orange-300 rounded-lg p-6 text-center hover:border-orange-500 transition-all">
            <input
              type="file"
              accept=".csv"
              onChange={onImport}
              className="hidden"
              id="csv-upload"
            />
            <label 
              htmlFor="csv-upload"
              className="cursor-pointer flex flex-col items-center gap-3"
            >
              <Upload size={48} className="text-orange-500" />
              <div>
                <p className="font-bold text-gray-800">Cliquez pour choisir un fichier CSV</p>
                <p className="text-sm text-gray-600">ou glissez-déposez ici</p>
              </div>
            </label>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
};

// Vue Analytics (simplifée pour Supabase)
const AnalyticsView = ({ entities }) => {
  const [allEmails, setAllEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadAllEmails();
  }, [entities]);

  const loadAllEmails = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('emails')
      .select('*, entities(name)')
      .order('date_envoi', { ascending: false });
    
    if (!handleSupabaseError(error)) {
      setAllEmails(data || []);
    }
    setLoading(false);
  };

  const getFilteredEmails = () => {
    let filtered = [...allEmails];

    if (dateDebut) {
      filtered = filtered.filter(e => new Date(e.date_envoi) >= new Date(dateDebut));
    }
    if (dateFin) {
      filtered = filtered.filter(e => new Date(e.date_envoi) <= new Date(dateFin));
    }
    if (searchTerm) {
      filtered = filtered.filter(e =>
        e.titre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.thematique?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  };

  const stats = {
    total: allEmails.length,
    envoyes: allEmails.filter(e => new Date(e.date_envoi) < new Date()).length,
    aVenir: allEmails.filter(e => new Date(e.date_envoi) >= new Date()).length,
    batValides: allEmails.filter(e => e.bat_valide).length
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white/90 backdrop-blur-lg rounded-2xl p-6 border-2 border-orange-200">
          <div className="text-3xl font-bold gradient-text mb-2">{stats.total}</div>
          <div className="text-sm text-gray-600">Total emails</div>
        </div>
        <div className="bg-white/90 backdrop-blur-lg rounded-2xl p-6 border-2 border-green-200">
          <div className="text-3xl font-bold text-green-600 mb-2">{stats.envoyes}</div>
          <div className="text-sm text-gray-600">Envoyés</div>
        </div>
        <div className="bg-white/90 backdrop-blur-lg rounded-2xl p-6 border-2 border-blue-200">
          <div className="text-3xl font-bold text-blue-600 mb-2">{stats.aVenir}</div>
          <div className="text-sm text-gray-600">À venir</div>
        </div>
        <div className="bg-white/90 backdrop-blur-lg rounded-2xl p-6 border-2 border-purple-200">
          <div className="text-3xl font-bold text-purple-600 mb-2">{stats.batValides}</div>
          <div className="text-sm text-gray-600">BAT validés</div>
        </div>
      </div>

      {/* Filtres Analytics */}
      <div className="bg-white/90 backdrop-blur-lg rounded-2xl p-6 border-2 border-orange-200">
        <div className="flex items-center gap-3 mb-4">
          <Search size={20} className="text-orange-600" />
          <h2 className="text-lg font-bold text-gray-800">Recherche & Filtres</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="Rechercher par titre ou thématique..."
            className="px-4 py-3 border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <input
            type="date"
            className="px-4 py-3 border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:outline-none"
            value={dateDebut}
            onChange={(e) => setDateDebut(e.target.value)}
            placeholder="Date début"
          />
          <input
            type="date"
            className="px-4 py-3 border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:outline-none"
            value={dateFin}
            onChange={(e) => setDateFin(e.target.value)}
            placeholder="Date fin"
          />
        </div>
      </div>

      {/* Liste des emails */}
      <div className="bg-white/90 backdrop-blur-lg rounded-2xl p-6 border-2 border-orange-200">
        <h3 className="text-lg font-bold text-gray-800 mb-4">
          Emails trouvés ({getFilteredEmails().length})
        </h3>
        {loading ? (
          <div className="text-center py-8 text-gray-600">Chargement...</div>
        ) : (
          <div className="space-y-3">
            {getFilteredEmails().map((email) => (
              <div
                key={email.id}
                className="p-4 bg-orange-50 rounded-lg hover:bg-orange-100 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-gray-800">{email.titre}</h4>
                    <div className="flex items-center gap-3 text-sm text-gray-600 mt-1 flex-wrap">
                      <span className="mono">{new Date(email.date_envoi).toLocaleDateString('fr-FR')}</span>
                      {email.thematique && (
                        <span className="bg-orange-200 px-2 py-1 rounded text-xs font-semibold">
                          {email.thematique}
                        </span>
                      )}
                      {email.entities && (
                        <span className="bg-purple-200 px-2 py-1 rounded text-xs font-semibold">
                          {email.entities.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {email.crea_realisee && <CheckCircle size={16} className="text-green-600" />}
                    {email.bat_valide && <CheckCircle size={16} className="text-blue-600" />}
                    {email.dans_planning_sre && <CheckCircle size={16} className="text-purple-600" />}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const CampaignsView = ({ entities }) => {
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCampaigns();
  }, [entities]);

  const loadCampaigns = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('campaigns')
      .select(`
        *,
        entities(name),
        operations(*)
      `)
      .order('date_debut', { ascending: false });
    
    if (!handleSupabaseError(error)) {
      setCampaigns(data || []);
    }
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
        {/* Détail campagne */}
        <div className="bg-white/90 backdrop-blur-lg rounded-2xl p-6 border-2 border-orange-200">
          <button
            onClick={() => setSelectedCampaign(null)}
            className="btn-secondary mb-4 flex items-center gap-2"
          >
            ← Retour aux campagnes
          </button>
          
          <h2 className="text-3xl font-bold gradient-text mb-4">
            📂 {selectedCampaign.name}
          </h2>
          
          {selectedCampaign.description && (
            <p className="text-gray-600 mb-4">{selectedCampaign.description}</p>
          )}
          
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {selectedCampaign.operations.length}
              </div>
              <div className="text-sm text-gray-600">Opérations</div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {selectedCampaign.operations.filter(o => o.type === 'email').length}
              </div>
              <div className="text-sm text-gray-600">Emails</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {selectedCampaign.operations.filter(o => o.type === 'slider').length}
              </div>
              <div className="text-sm text-gray-600">Sliders</div>
            </div>
          </div>
          
          <div className="text-sm text-gray-600 mb-6">
            📅 Du {new Date(selectedCampaign.date_debut).toLocaleDateString('fr-FR')} 
            au {new Date(selectedCampaign.date_fin).toLocaleDateString('fr-FR')}
          </div>
          
          {/* Timeline des opérations */}
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-gray-800">Timeline</h3>
            {selectedCampaign.operations
              .sort((a, b) => new Date(a.date_envoi) - new Date(b.date_envoi))
              .map(op => (
                <div key={op.id} className="bg-gray-50 p-4 rounded-lg border-2 border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">
                        {op.type === 'email' ? '📧' : '🖼️'}
                      </span>
                      <div>
                        <div className="font-semibold">{op.titre}</div>
                        <div className="text-sm text-gray-600">
                          {new Date(op.date_envoi).toLocaleDateString('fr-FR')} • {op.langue}
                        </div>
                      </div>
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
      {/* Liste des campagnes */}
      <div className="bg-white/90 backdrop-blur-lg rounded-2xl p-6 border-2 border-orange-200">
        <h2 className="text-2xl font-bold gradient-text mb-6">📂 Mes Campagnes</h2>
        
        {loading ? (
          <div className="text-center py-8">Chargement...</div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-8 text-gray-600">
            Aucune campagne pour le moment
          </div>
        ) : (
          <div className="space-y-4">
            {campaigns.map(campaign => {
              const stats = getCampaignStats(campaign);
              return (
                <div
                  key={campaign.id}
                  onClick={() => setSelectedCampaign(campaign)}
                  className="p-6 bg-gradient-to-r from-orange-50 to-rose-50 rounded-xl border-2 border-orange-200 hover:border-orange-400 cursor-pointer transition-all card-hover"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-800 mb-2">
                        {campaign.name}
                      </h3>
                      <div className="text-sm text-gray-600">
                        {campaign.entities?.name} • {stats.total} opération(s)
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-orange-600">
                        {stats.percentage}%
                      </div>
                      <div className="text-xs text-gray-600">
                        {stats.validated}/{stats.total} validées
                      </div>
                    </div>
                  </div>
                  
                  {/* Barre de progression */}
                  <div className="w-full bg-gray-200 rounded-full h-3 mb-3">
                    <div
                      className="bg-gradient-to-r from-orange-500 to-rose-500 h-3 rounded-full transition-all"
                      style={{ width: `${stats.percentage}%` }}
                    ></div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span>📅 {new Date(campaign.date_debut).toLocaleDateString('fr-FR')}</span>
                    <span>→</span>
                    <span>{new Date(campaign.date_fin).toLocaleDateString('fr-FR')}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailManagementTool;
