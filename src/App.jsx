import React, { useState, useEffect } from 'react';
import { Upload, Plus, Search, Calendar, Filter, AlertCircle, CheckCircle, Clock, TrendingUp, Download, X, Trash2, Archive, ArchiveRestore } from 'lucide-react';

// Simulated Supabase storage (will be replaced with actual Supabase in production)
const useLocalStorage = (key, initialValue) => {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      setStoredValue(value);
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue];
};

const EmailManagementTool = () => {
  // États principaux
  const [activeEntity, setActiveEntity] = useState('J4C');
  const [entities, setEntities] = useLocalStorage('entities', ['J4C', 'Narbonne Accessoires', 'CTCARR', 'Accessoires Outdoor']);
  const [emails, setEmails] = useLocalStorage('emails', {});
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

  // Initialiser les emails pour chaque entité
  useEffect(() => {
    const newEmails = { ...emails };
    entities.forEach(entity => {
      if (!newEmails[entity]) {
        newEmails[entity] = [];
      }
    });
    setEmails(newEmails);
  }, [entities]);

  // Fonction pour ajouter un email
  const addEmail = (emailData) => {
    const newEmail = {
      id: Date.now().toString(),
      dateEnvoi: emailData.dateEnvoi,
      titre: emailData.titre,
      thematique: emailData.thematique,
      langue: emailData.langue || 'FR',
      brief: emailData.brief || '',
      objet: '',
      preheader: '',
      corps: '',
      produits: [],
      creaRealisee: false,
      batEnvoyeEric: false,
      batEnvoyeMarketing: false,
      batValide: false,
      dateValidationBAT: '',
      dansPlanningsSRE: false,
      dateAjoutSRE: '',
      archived: false,
      archivedAt: '',
      createdAt: new Date().toISOString()
    };

    const updatedEmails = { ...emails };
    updatedEmails[activeEntity] = [...(updatedEmails[activeEntity] || []), newEmail];
    setEmails(updatedEmails);
    setShowAddModal(false);
  };

  // Import CSV avec parsing amélioré
  const handleCSVImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        
        // Parser CSV en gérant les guillemets et virgules dans les valeurs
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
                i++; // Skip next quote
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

        // Séparer les lignes en gérant différents types de retours à la ligne
        const lines = text.split(/\r?\n/).filter(line => line.trim());
        
        if (lines.length < 2) {
          alert('❌ Le fichier CSV est vide ou invalide. Il doit contenir au moins une ligne d\'en-têtes et une ligne de données.');
          return;
        }

        // Parser les en-têtes
        const headers = parseCSVLine(lines[0]).map(h => 
          h.toLowerCase()
            .replace(/\s+/g, '')
            .replace(/[éèêë]/g, 'e')
            .replace(/[àâä]/g, 'a')
        );
        
        console.log('En-têtes détectés:', headers);

        // Vérifier que les colonnes essentielles existent
        const hasDate = headers.some(h => h.includes('date') || h === 'dateenvoi');
        const hasTitle = headers.some(h => h.includes('titre') || h.includes('title'));
        
        if (!hasDate) {
          alert('❌ Colonne "date" ou "dateenvoi" manquante dans le CSV.');
          return;
        }

        const newEmails = [];
        let importedCount = 0;
        let skippedCount = 0;

        // Parser chaque ligne
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          
          const values = parseCSVLine(lines[i]);
          const emailObj = {};
          
          // Mapper les valeurs aux en-têtes
          headers.forEach((header, index) => {
            emailObj[header] = values[index] || '';
          });

          // Trouver la date (supporter différents noms de colonnes)
          const dateValue = emailObj.dateenvoi || emailObj.date || emailObj.dateenvoie || 
                           emailObj.datedenvoi || emailObj.senddate;

          if (dateValue && dateValue.trim()) {
            newEmails.push({
              dateEnvoi: dateValue.trim(),
              titre: emailObj.titre || emailObj.title || emailObj.nom || 'Sans titre',
              thematique: emailObj.thematique || emailObj.theme || emailObj.type || '',
              langue: emailObj.langue || emailObj.language || emailObj.lang || 'FR',
              brief: emailObj.brief || emailObj.description || emailObj.message || ''
            });
            importedCount++;
          } else {
            console.warn(`Ligne ${i + 1} ignorée (pas de date):`, values);
            skippedCount++;
          }
        }

        if (newEmails.length === 0) {
          alert('❌ Aucun email valide trouvé dans le CSV.\n\nVérifiez que :\n- Il y a une colonne "dateenvoi" ou "date"\n- Les lignes contiennent des dates valides');
          return;
        }

        // Ajouter tous les emails
        newEmails.forEach(email => addEmail(email));
        
        // Message de confirmation
        alert(`✅ Import réussi !\n\n${importedCount} email(s) importé(s)${skippedCount > 0 ? `\n${skippedCount} ligne(s) ignorée(s) (pas de date)` : ''}`);
        
        setShowImportModal(false);
        
      } catch (error) {
        console.error('Erreur lors de l\'import CSV:', error);
        alert('❌ Erreur lors de l\'import du CSV.\n\n' + error.message + '\n\nVérifiez le format de votre fichier.');
      }
    };
    
    reader.onerror = () => {
      alert('❌ Erreur lors de la lecture du fichier.');
    };
    
    reader.readAsText(file, 'UTF-8');
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
    let filtered = emails[activeEntity] || [];

    // Par défaut, ne pas afficher les emails archivés sauf si le filtre est activé
    if (!filters.archives) {
      filtered = filtered.filter(e => !e.archived);
    } else {
      // Si le filtre archives est activé, montrer SEULEMENT les archivés
      filtered = filtered.filter(e => e.archived);
    }

    if (filters.creaRealisee) {
      filtered = filtered.filter(e => e.creaRealisee);
    }
    if (filters.batValide) {
      filtered = filtered.filter(e => e.batValide);
    }
    if (filters.dansSRE) {
      filtered = filtered.filter(e => e.dansPlanningsSRE);
    }
    if (filters.pasDansSRE) {
      filtered = filtered.filter(e => !e.dansPlanningsSRE);
    }
    if (filters.thematique) {
      filtered = filtered.filter(e => e.thematique.toLowerCase().includes(filters.thematique.toLowerCase()));
    }
    if (filters.langue) {
      filtered = filtered.filter(e => e.langue === filters.langue);
    }
    if (filters.dateDebut) {
      filtered = filtered.filter(e => new Date(e.dateEnvoi) >= new Date(filters.dateDebut));
    }
    if (filters.dateFin) {
      filtered = filtered.filter(e => new Date(e.dateEnvoi) <= new Date(filters.dateFin));
    }

    // Tri par date d'envoi
    return filtered.sort((a, b) => new Date(a.dateEnvoi) - new Date(b.dateEnvoi));
  };

  // Mettre à jour un email
  const updateEmail = (emailId, updates) => {
    const updatedEmails = { ...emails };
    const emailIndex = updatedEmails[activeEntity].findIndex(e => e.id === emailId);
    if (emailIndex !== -1) {
      updatedEmails[activeEntity][emailIndex] = {
        ...updatedEmails[activeEntity][emailIndex],
        ...updates
      };
      setEmails(updatedEmails);
    }
  };

  // Supprimer un email
  const deleteEmail = (emailId) => {
    if (window.confirm('⚠️ Êtes-vous sûr de vouloir supprimer cet email ?\n\nCette action est irréversible.')) {
      const updatedEmails = { ...emails };
      updatedEmails[activeEntity] = updatedEmails[activeEntity].filter(e => e.id !== emailId);
      setEmails(updatedEmails);
    }
  };

  // Archiver un email
  const archiveEmail = (emailId) => {
    if (window.confirm('📦 Archiver cet email ?\n\nL\'email sera marqué comme archivé et pourra être filtré.')) {
      updateEmail(emailId, { archived: true, archivedAt: new Date().toISOString() });
    }
  };

  // Désarchiver un email
  const unarchiveEmail = (emailId) => {
    updateEmail(emailId, { archived: false, archivedAt: '' });
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
      `}</style>

      {/* Header */}
      <div className="bg-white/80 backdrop-blur-lg border-b-2 border-orange-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold gradient-text">Email Campaign Manager</h1>
              <p className="text-sm text-gray-600 mt-1 mono">Gestion centralisée des campagnes marketing</p>
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
              key={entity}
              onClick={() => {
                setActiveEntity(entity);
                setShowAnalytics(false);
              }}
              className={`px-6 py-3 rounded-lg font-semibold whitespace-nowrap transition-all ${
                activeEntity === entity && !showAnalytics
                  ? 'tab-active'
                  : 'bg-white hover:bg-orange-50 text-gray-700'
              }`}
            >
              {entity}
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
            onClick={() => {
              const newEntity = prompt('Nom de la nouvelle entité :');
              if (newEntity && !entities.includes(newEntity)) {
                setEntities([...entities, newEntity]);
              }
            }}
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
              {getFilteredEmails().length === 0 ? (
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
                    alert={getAlertStatus(email.dateEnvoi)}
                  />
                ))
              )}
            </div>
          </>
        ) : (
          <AnalyticsView emails={emails} entities={entities} />
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-3xl w-full border-4 border-orange-300 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold gradient-text">Importer un fichier CSV</h2>
              <button onClick={() => setShowImportModal(false)} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            
            <div className="mb-6 space-y-4">
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                <h3 className="font-bold text-blue-900 mb-2">📋 Format attendu</h3>
                <p className="text-sm text-blue-800 mb-2">
                  Votre CSV doit contenir ces colonnes (l'ordre n'a pas d'importance) :
                </p>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li><strong>dateenvoi</strong> ou <strong>date</strong> (obligatoire) - Format : YYYY-MM-DD ou DD/MM/YYYY</li>
                  <li><strong>titre</strong> ou <strong>title</strong> (recommandé) - Le nom de votre campagne</li>
                  <li><strong>thematique</strong> ou <strong>theme</strong> (optionnel) - Ex: Nouveauté, Promotion, etc.</li>
                  <li><strong>langue</strong> ou <strong>lang</strong> (optionnel) - Ex: FR, EN, ES, IT</li>
                  <li><strong>brief</strong> ou <strong>description</strong> (optionnel) - Description de la campagne</li>
                </ul>
              </div>

              <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4">
                <h3 className="font-bold text-orange-900 mb-2">✅ Exemple valide</h3>
                <pre className="text-xs mono bg-white p-3 rounded border border-orange-200 overflow-x-auto">
{`dateenvoi,titre,thematique,langue,brief
2024-03-15,Nouvelle collection printemps,Nouveauté,FR,Découvrez nos nouveautés
2024-03-20,Vente Flash 48h,Promotion,FR,50% sur tout le site
2024-03-25,Black Friday Preview,Promotion,EN,Early access deals`}
                </pre>
              </div>

              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                <h3 className="font-bold text-green-900 mb-2">💡 Astuces</h3>
                <ul className="text-sm text-green-800 space-y-1 list-disc list-inside">
                  <li>Vous pouvez exporter depuis Excel en choisissant "CSV UTF-8"</li>
                  <li>Les noms de colonnes ne sont pas sensibles aux accents ou à la casse</li>
                  <li>Les lignes sans date seront automatiquement ignorées</li>
                  <li>Si le titre est vide, il sera remplacé par "Sans titre"</li>
                </ul>
              </div>

              <div className="border-2 border-dashed border-orange-300 rounded-lg p-6 text-center hover:border-orange-500 transition-all">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCSVImport}
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
              <button onClick={() => setShowImportModal(false)} className="btn-secondary flex-1">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Composant Card Email
const EmailCard = ({ email, onUpdate, onDelete, onArchive, onUnarchive, alert }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`bg-white/90 backdrop-blur-lg rounded-2xl p-6 border-2 card-hover ${
      email.archived ? 'border-gray-300 opacity-75' : 'border-orange-200'
    }`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
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
            {!email.archived && !email.dansPlanningsSRE && (
              <span className="bg-yellow-100 text-yellow-700 text-xs px-3 py-1 rounded-full font-semibold">
                À ajouter au planning SRE
              </span>
            )}
            {!email.archived && email.batValide && !email.dateValidationBAT && (
              <span className="bg-blue-100 text-blue-700 text-xs px-3 py-1 rounded-full font-semibold">
                À mettre dans le planning SRE – BAT validé
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span className="flex items-center gap-1 mono">
              <Calendar size={14} />
              {new Date(email.dateEnvoi).toLocaleDateString('fr-FR')}
            </span>
            <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-semibold">
              {email.thematique}
            </span>
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
            checked={email.creaRealisee}
            onChange={(e) => onUpdate({ creaRealisee: e.target.checked })}
          />
          <span className="text-sm font-medium">Créa réalisée</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer p-3 bg-orange-50 rounded-lg hover:bg-orange-100 transition-all">
          <input
            type="checkbox"
            className="checkbox-custom"
            checked={email.batEnvoyeEric}
            onChange={(e) => onUpdate({ batEnvoyeEric: e.target.checked })}
          />
          <span className="text-sm font-medium">BAT → Eric</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer p-3 bg-orange-50 rounded-lg hover:bg-orange-100 transition-all">
          <input
            type="checkbox"
            className="checkbox-custom"
            checked={email.batEnvoyeMarketing}
            onChange={(e) => onUpdate({ batEnvoyeMarketing: e.target.checked })}
          />
          <span className="text-sm font-medium">BAT → Marketing</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer p-3 bg-orange-50 rounded-lg hover:bg-orange-100 transition-all">
          <input
            type="checkbox"
            className="checkbox-custom"
            checked={email.batValide}
            onChange={(e) => onUpdate({ batValide: e.target.checked })}
          />
          <span className="text-sm font-medium">BAT validé</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer p-3 bg-green-50 rounded-lg hover:bg-green-100 transition-all">
          <input
            type="checkbox"
            className="checkbox-custom"
            checked={email.dansPlanningsSRE}
            onChange={(e) => onUpdate({
              dansPlanningsSRE: e.target.checked,
              dateAjoutSRE: e.target.checked ? new Date().toISOString() : ''
            })}
          />
          <span className="text-sm font-medium">Dans planning SRE</span>
        </label>
      </div>

      {/* Date de validation BAT */}
      {email.batValide && (
        <div className="mb-4 p-4 bg-blue-50 rounded-lg">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Date de validation totale du BAT
          </label>
          <input
            type="date"
            className="w-full px-4 py-2 border-2 border-blue-200 rounded-lg focus:border-blue-500 focus:outline-none"
            value={email.dateValidationBAT}
            onChange={(e) => onUpdate({ dateValidationBAT: e.target.value })}
          />
        </div>
      )}

      {/* Contenu détaillé (développable) */}
      {expanded && (
        <div className="mt-6 pt-6 border-t-2 border-orange-200 space-y-4 animate-in fade-in duration-300">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Brief</label>
            <textarea
              className="w-full px-4 py-3 border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:outline-none"
              rows={2}
              value={email.brief}
              onChange={(e) => onUpdate({ brief: e.target.value })}
              placeholder="Description du brief..."
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Objet</label>
            <input
              type="text"
              className="w-full px-4 py-3 border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:outline-none"
              value={email.objet}
              onChange={(e) => onUpdate({ objet: e.target.value })}
              placeholder="Objet de l'email..."
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Pre-header</label>
            <input
              type="text"
              className="w-full px-4 py-3 border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:outline-none"
              value={email.preheader}
              onChange={(e) => onUpdate({ preheader: e.target.value })}
              placeholder="Pre-header..."
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Corps du message</label>
            <textarea
              className="w-full px-4 py-3 border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:outline-none"
              rows={4}
              value={email.corps}
              onChange={(e) => onUpdate({ corps: e.target.value })}
              placeholder="Contenu de l'email..."
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Produits à intégrer</label>
            <input
              type="text"
              className="w-full px-4 py-3 border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:outline-none"
              value={email.produits.join(', ')}
              onChange={(e) => onUpdate({ produits: e.target.value.split(',').map(p => p.trim()) })}
              placeholder="Produit1, Produit2, Produit3..."
            />
          </div>
        </div>
      )}
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

// Vue Analytics
const AnalyticsView = ({ emails, entities }) => {
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const getAllEmails = () => {
    let allEmails = [];
    entities.forEach(entity => {
      if (emails[entity]) {
        allEmails = [...allEmails, ...emails[entity].map(e => ({ ...e, entity }))];
      }
    });
    return allEmails;
  };

  const getFilteredEmails = () => {
    let filtered = getAllEmails();

    if (dateDebut) {
      filtered = filtered.filter(e => new Date(e.dateEnvoi) >= new Date(dateDebut));
    }
    if (dateFin) {
      filtered = filtered.filter(e => new Date(e.dateEnvoi) <= new Date(dateFin));
    }
    if (searchTerm) {
      filtered = filtered.filter(e =>
        e.titre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.thematique.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered.sort((a, b) => new Date(b.dateEnvoi) - new Date(a.dateEnvoi));
  };

  const stats = {
    total: getAllEmails().length,
    envoyes: getAllEmails().filter(e => new Date(e.dateEnvoi) < new Date()).length,
    aVenir: getAllEmails().filter(e => new Date(e.dateEnvoi) >= new Date()).length,
    batValides: getAllEmails().filter(e => e.batValide).length
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
        <div className="space-y-3">
          {getFilteredEmails().map((email) => (
            <div
              key={email.id}
              className="p-4 bg-orange-50 rounded-lg hover:bg-orange-100 transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-gray-800">{email.titre}</h4>
                  <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
                    <span className="mono">{new Date(email.dateEnvoi).toLocaleDateString('fr-FR')}</span>
                    <span className="bg-orange-200 px-2 py-1 rounded text-xs font-semibold">
                      {email.thematique}
                    </span>
                    <span className="bg-purple-200 px-2 py-1 rounded text-xs font-semibold">
                      {email.entity}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {email.creaRealisee && <CheckCircle size={16} className="text-green-600" />}
                  {email.batValide && <CheckCircle size={16} className="text-blue-600" />}
                  {email.dansPlanningsSRE && <CheckCircle size={16} className="text-purple-600" />}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EmailManagementTool;
