export const questionTranslations: Record<string, {
  de: { questionText: string; category: string; remediationGuidance: string; options: Record<string, string> };
  fr: { questionText: string; category: string; remediationGuidance: string; options: Record<string, string> };
}> = {
  'data-mapping-q1': {
    de: {
      category: 'Daten-Mapping',
      questionText: 'Wissen Sie genau, welche personenbezogenen Daten Ihre Organisation sammelt und speichert?',
      options: { 'Yes, fully documented': 'Ja, vollständig dokumentiert', 'Partially': 'Teilweise', 'No': 'Nein' },
      remediationGuidance: 'Führen Sie eine umfassende Dateninventur über alle Abteilungen und Systeme hinweg durch. Dokumentieren Sie jede Kategorie der gesammelten personenbezogenen Daten, deren Quelle und Speicherort. Nutzen Sie dies, um Ihr Verzeichnis von Verarbeitungstätigkeiten (VVT) zu füllen.'
    },
    fr: {
      category: 'Cartographie des données',
      questionText: 'Savez-vous exactement quelles données personnelles votre organisation collecte et stocke ?',
      options: { 'Yes, fully documented': 'Oui, entièrement documenté', 'Partially': 'Partiellement', 'No': 'Non' },
      remediationGuidance: 'Effectuez un inventaire complet des données dans tous les départements et systèmes. Documentez chaque catégorie de données personnelles collectées, leur source et leur lieu de stockage. Utilisez cela pour remplir votre Registre des activités de traitement (ROPA).'
    }
  },
  'data-mapping-q2': {
    de: {
      category: 'Daten-Mapping',
      questionText: 'Haben Sie alle Orte dokumentiert, an denen sich personenbezogene Daten befinden (CRM, E-Mail-Tools, Tabellen, Cloud-Speicher)?',
      options: { 'Yes, fully documented': 'Ja, vollständig dokumentiert', 'Partially': 'Teilweise', 'No': 'Nein' },
      remediationGuidance: 'Erstellen Sie ein Datenspeicher-Inventar, das jedes System, jede Anwendung und jeden physischen Ort kartiert. Aktualisieren Sie dieses Inventar, wenn neue Tools eingeführt werden.'
    },
    fr: {
      category: 'Cartographie des données',
      questionText: 'Avez-vous documenté tous les endroits où se trouvent les données personnelles (CRM, outils de messagerie, tableurs, stockage cloud) ?',
      options: { 'Yes, fully documented': 'Oui, entièrement documenté', 'Partially': 'Partiellement', 'No': 'Non' },
      remediationGuidance: 'Créez un inventaire de stockage des données cartographiant chaque système, application et emplacement physique. Mettez à jour cet inventaire chaque fois que de nouveaux outils sont adoptés.'
    }
  },
  'data-mapping-q3': {
    de: {
      category: 'Daten-Mapping',
      questionText: 'Wissen Sie, welche Ihrer Daten unter die "besonderen Kategorien" der DSGVO fallen (Gesundheit, Religion, Biometrie)?',
      options: { 'Yes, fully documented': 'Ja, vollständig dokumentiert', 'Not sure': 'Nicht sicher', 'We don\'t process special categories': 'Wir verarbeiten keine besonderen Kategorien' },
      remediationGuidance: 'Überprüfen Sie alle Datenfelder, um besondere Datenkategorien gemäß Artikel 9 zu identifizieren. Stellen Sie für jeden gefundenen Fall sicher, dass eine gültige Rechtsgrundlage nach Artikel 9 Absatz 2 dokumentiert ist.'
    },
    fr: {
      category: 'Cartographie des données',
      questionText: 'Savez-vous quelles données relèvent des "catégories particulières" du RGPD (santé, religion, biométrie) ?',
      options: { 'Yes, fully documented': 'Oui, entièrement documenté', 'Not sure': 'Pas sûr', 'We don\'t process special categories': 'Nous ne traitons pas de catégories particulières' },
      remediationGuidance: 'Auditez tous les champs de données pour identifier toute donnée de catégorie particulière selon l\'article 9. Pour chaque cas trouvé, assurez-vous qu\'une base légale valide selon l\'article 9(2) est documentée.'
    }
  },
  'data-mapping-q4': {
    de: {
      category: 'Daten-Mapping',
      questionText: 'Können Sie jeden Dritten identifizieren, mit dem Sie personenbezogene Daten teilen?',
      options: { 'Yes': 'Ja', 'Most of them': 'Die meisten', 'No': 'Nein' },
      remediationGuidance: 'Erstellen Sie ein vollständiges Anbieterregister (Vendor Register), das jeden Dritten auflistet, der personenbezogene Daten empfängt, verarbeitet oder Zugang dazu hat.'
    },
    fr: {
      category: 'Cartographie des données',
      questionText: 'Pouvez-vous identifier chaque tiers avec lequel vous partagez des données personnelles ?',
      options: { 'Yes': 'Oui', 'Most of them': 'La plupart', 'No': 'Non' },
      remediationGuidance: 'Compilez un registre complet des fournisseurs listant chaque tiers qui reçoit, traite ou a accès aux données personnelles.'
    }
  },
  'data-mapping-q5': {
    de: {
      category: 'Daten-Mapping',
      questionText: 'Haben Sie eine dokumentierte Richtlinie zur Datenaufbewahrung (Löschkonzept)?',
      options: { 'Yes, and it is enforced': 'Ja, und sie wird durchgesetzt', 'Yes, but not enforced': 'Ja, aber nicht durchgesetzt', 'No': 'Nein' },
      remediationGuidance: 'Definieren Sie Aufbewahrungsfristen für jede Datenkategorie basierend auf gesetzlichen Vorgaben. Implementieren Sie automatisierte Lösch- oder Anonymisierungs-Workflows.'
    },
    fr: {
      category: 'Cartographie des données',
      questionText: 'Avez-vous une politique de conservation des données documentée ?',
      options: { 'Yes, and it is enforced': 'Oui, et elle est appliquée', 'Yes, but not enforced': 'Oui, mais non appliquée', 'No': 'Non' },
      remediationGuidance: 'Définissez des périodes de conservation pour chaque catégorie de données. Mettez en œuvre des flux de suppression ou d\'anonymisation automatisés.'
    }
  },
  'lawful-basis-q1': {
    de: {
      category: 'Rechtsgrundlage',
      questionText: 'Haben Sie für jede verarbeitete Datenart eine Rechtsgrundlage identifiziert (Einwilligung, Vertrag, berechtigtes Interesse usw.)?',
      options: { 'Yes': 'Ja', 'Partially': 'Teilweise', 'No': 'Nein' },
      remediationGuidance: 'Ordnen Sie in Ihrem VVT jede Verarbeitungstätigkeit einer der sechs Rechtsgrundlagen nach Artikel 6(1) zu.'
    },
    fr: {
      category: 'Base légale',
      questionText: 'Avez-vous identifié une base légale (consentement, contrat, intérêt légitime, etc.) pour chaque type de données que vous traitez ?',
      options: { 'Yes': 'Oui', 'Partially': 'Partiellement', 'No': 'Non' },
      remediationGuidance: 'Associez chaque activité de traitement dans votre ROPA à l\'une des six bases légales de l\'article 6(1).'
    }
  },
  'lawful-basis-q2': {
    de: {
      category: 'Rechtsgrundlage',
      questionText: 'Wenn Sie sich auf eine Einwilligung stützen, können Personen diese genauso einfach widerrufen, wie sie erteilt wurde?',
      options: { 'Yes': 'Ja', 'No, it requires email or support': 'Nein, es erfordert eine E-Mail oder den Support', 'We don\'t rely on consent': 'Wir stützen uns nicht auf Einwilligungen' },
      remediationGuidance: 'Implementieren Sie einen Self-Service-Widerrufsmechanismus für Einwilligungen, der so einfach zugänglich ist wie die Methode zur Einholung der Einwilligung.'
    },
    fr: {
      category: 'Base légale',
      questionText: 'Si vous vous appuyez sur le consentement, les personnes peuvent-elles le retirer aussi facilement qu\'elles l\'ont donné ?',
      options: { 'Yes': 'Oui', 'No, it requires email or support': 'Non, cela nécessite un email ou le support', 'We don\'t rely on consent': 'Nous ne nous appuyons pas sur le consentement' },
      remediationGuidance: 'Mettez en place un mécanisme de retrait du consentement en libre-service aussi simple et accessible que la méthode utilisée pour le recueillir.'
    }
  },
  'lawful-basis-q3': {
    de: {
      category: 'Rechtsgrundlage',
      questionText: 'Wenn Sie sich auf ein berechtigtes Interesse stützen, haben Sie eine Interessenabwägung (LIA) dokumentiert?',
      options: { 'Yes': 'Ja', 'No': 'Nein', 'We don\'t rely on legitimate interest': 'Wir stützen uns nicht auf ein berechtigtes Interesse' },
      remediationGuidance: 'Führen Sie für jede Verarbeitung, die auf einem berechtigten Interesse beruht, eine Interessenabwägung (Legitimate Interest Assessment) durch und dokumentieren Sie diese.'
    },
    fr: {
      category: 'Base légale',
      questionText: 'Si vous vous appuyez sur l\'intérêt légitime, avez-vous documenté une mise en balance des intérêts (LIA) ?',
      options: { 'Yes': 'Oui', 'No': 'Non', 'We don\'t rely on legitimate interest': 'Nous ne nous appuyons pas sur l\'intérêt légitime' },
      remediationGuidance: 'Effectuez et documentez une évaluation de l\'intérêt légitime (LIA) pour chaque activité de traitement reposant sur l\'intérêt légitime.'
    }
  },
  'lawful-basis-q4': {
    de: {
      category: 'Rechtsgrundlage',
      questionText: 'Erfüllen Ihre Einwilligungsmechanismen die DSGVO-Standards (ausdrücklich, spezifisch, freiwillig)?',
      options: { 'Yes, opt-in only': 'Ja, nur Opt-in', 'No, we use pre-ticked boxes/implied consent': 'Nein, wir verwenden vorausgefüllte Kästchen/stillschweigende Einwilligung', 'Not sure': 'Nicht sicher' },
      remediationGuidance: 'Ersetzen Sie alle vorausgefüllten Kontrollkästchen durch ausdrückliche Opt-in-Kontrollen.'
    },
    fr: {
      category: 'Base légale',
      questionText: 'Vos mécanismes de consentement répondent-ils aux normes du RGPD (explicite, spécifique, librement donné) ?',
      options: { 'Yes, opt-in only': 'Oui, opt-in uniquement', 'No, we use pre-ticked boxes/implied consent': 'Non, nous utilisons des cases pré-cochées / consentement implicite', 'Not sure': 'Pas sûr' },
      remediationGuidance: 'Remplacez les cases pré-cochées ou les mécanismes de consentement implicite par des contrôles explicites d\'opt-in.'
    }
  },
  'lawful-basis-q5': {
    de: {
      category: 'Rechtsgrundlage',
      questionText: 'Gibt Ihre Datenschutzerklärung für jeden Verarbeitungszweck eindeutig die Rechtsgrundlage an?',
      options: { 'Yes': 'Ja', 'Partially': 'Teilweise', 'No': 'Nein' },
      remediationGuidance: 'Aktualisieren Sie Ihre Datenschutzerklärung, um die Rechtsgrundlage für jeden bestimmten Verarbeitungszweck ausdrücklich anzugeben.'
    },
    fr: {
      category: 'Base légale',
      questionText: 'Votre politique de confidentialité précise-t-elle clairement la base légale pour chaque finalité de traitement ?',
      options: { 'Yes': 'Oui', 'Partially': 'Partiellement', 'No': 'Non' },
      remediationGuidance: 'Mettez à jour votre politique de confidentialité pour indiquer explicitement la base légale sur laquelle repose chaque finalité de traitement distincte.'
    }
  },
  'vendor-management-q1': {
    de: {
      category: 'Anbietermanagement',
      questionText: 'Haben Sie mit jedem SaaS-Tool, das personenbezogene Daten verarbeitet, einen Auftragsverarbeitungsvertrag (AVV) abgeschlossen?',
      options: { 'Yes': 'Ja', 'Some of them': 'Mit einigen', 'No': 'Nein' },
      remediationGuidance: 'Schließen Sie einen DSGVO-konformen Auftragsverarbeitungsvertrag (AVV) mit jedem Anbieter ab, der personenbezogene Daten in Ihrem Auftrag verarbeitet.'
    },
    fr: {
      category: 'Gestion des fournisseurs',
      questionText: 'Avez-vous signé un Accord de Traitement des Données (DPA) avec chaque outil SaaS qui traite des données personnelles ?',
      options: { 'Yes': 'Oui', 'Some of them': 'Certains d\'entre eux', 'No': 'Non' },
      remediationGuidance: 'Concluez un Accord de Traitement des Données (DPA) conforme au RGPD avec chaque fournisseur qui traite des données personnelles pour votre compte.'
    }
  },
  'vendor-management-q2': {
    de: {
      category: 'Anbietermanagement',
      questionText: 'Wissen Sie, welche Ihrer Tools Daten aus der EU in Drittländer übermitteln?',
      options: { 'Yes, and we have SCCs in place': 'Ja, und wir haben SCCs im Einsatz', 'Yes, but no safeguards': 'Ja, aber keine Schutzmaßnahmen', 'No': 'Nein' },
      remediationGuidance: 'Identifizieren Sie alle Anbieter und Systeme, die personenbezogene Daten in Länder außerhalb der EU/des EWR übermitteln. Implementieren Sie für jede Übermittlung eine geeignete Schutzmaßnahme (z. B. SCCs).'
    },
    fr: {
      category: 'Gestion des fournisseurs',
      questionText: 'Savez-vous quels outils transfèrent des données en dehors de l\'UE ?',
      options: { 'Yes, and we have SCCs in place': 'Oui, et nous avons des CCT en place', 'Yes, but no safeguards': 'Oui, mais sans garanties', 'No': 'Non' },
      remediationGuidance: 'Identifiez tous les fournisseurs et systèmes qui transfèrent des données personnelles vers des pays hors UE/EEE. Mettez en œuvre une garantie appropriée (ex. CCT).'
    }
  },
  'vendor-management-q3': {
    de: {
      category: 'Anbietermanagement',
      questionText: 'Haben Sie die Datenschutzrisiken Ihrer Anbieter und Tools außerhalb der EU/des EWR bewertet?',
      options: { 'Yes, via TIA (Transfer Impact Assessment)': 'Ja, mittels TIA', 'No': 'Nein', 'We don\'t use vendors outside the EU/EEA': 'Wir nutzen keine Anbieter außerhalb der EU/des EWR' },
      remediationGuidance: 'Führen Sie für jede internationale Datenübermittlung ein Transfer Impact Assessment (TIA) durch, wie es das Schrems-II-Urteil vorschreibt.'
    },
    fr: {
      category: 'Gestion des fournisseurs',
      questionText: 'Avez-vous évalué les risques en matière de confidentialité de vos fournisseurs et outils basés hors UE/EEE ?',
      options: { 'Yes, via TIA (Transfer Impact Assessment)': 'Oui, via un TIA (Évaluation de l\'Impact du Transfert)', 'No': 'Non', 'We don\'t use vendors outside the EU/EEA': 'Nous n\'utilisons pas de fournisseurs hors UE/EEE' },
      remediationGuidance: 'Effectuez une Évaluation de l\'Impact du Transfert (TIA) pour chaque transfert international de données, tel que requis par l\'arrêt Schrems II.'
    }
  },
  'vendor-management-q4': {
    de: {
      category: 'Anbietermanagement',
      questionText: 'Übermitteln Sie personenbezogene Daten international durch Ihre eigenen Abläufe (z. B. Remote-Mitarbeiter, internationale Niederlassungen)?',
      options: { 'Yes, with appropriate safeguards like SCCs': 'Ja, mit geeigneten Schutzmaßnahmen wie SCCs', 'Yes, without safeguards': 'Ja, ohne Schutzmaßnahmen', 'No': 'Nein' },
      remediationGuidance: 'Implementieren Sie geeignete Übermittlungsmechanismen für alle internen internationalen Datenflüsse (z. B. BCRs oder SCCs).'
    },
    fr: {
      category: 'Gestion des fournisseurs',
      questionText: 'Transférez-vous des données personnelles à l\'international dans le cadre de vos propres opérations (ex. travailleurs à distance, succursales internationales) ?',
      options: { 'Yes, with appropriate safeguards like SCCs': 'Oui, avec des garanties appropriées comme les CCT', 'Yes, without safeguards': 'Oui, sans garanties', 'No': 'Non' },
      remediationGuidance: 'Mettez en œuvre des mécanismes de transfert appropriés pour tous les flux internes internationaux de données (ex. BCR ou CCT).'
    }
  },
  'vendor-management-q5': {
    de: {
      category: 'Anbietermanagement',
      questionText: 'Überwachen Sie, wenn Ihre Anbieter ihre Unterauftragsverarbeiter wechseln?',
      options: { 'Yes': 'Ja', 'No': 'Nein' },
      remediationGuidance: 'Richten Sie einen Prozess zur Überwachung von Unterauftragsverarbeitern ein. Abonnieren Sie Änderungsbenachrichtigungen auf der Seite jedes Anbieters.'
    },
    fr: {
      category: 'Gestion des fournisseurs',
      questionText: 'Surveillez-vous lorsque vos fournisseurs changent de sous-traitants ?',
      options: { 'Yes': 'Oui', 'No': 'Non' },
      remediationGuidance: 'Établissez un processus de surveillance des sous-traitants. Abonnez-vous aux notifications de changement depuis la liste des sous-traitants de chaque fournisseur.'
    }
  },
  'vendor-management-q6': {
    de: {
      category: 'Anbietermanagement',
      questionText: 'Haben Sie die Sicherheitszertifikate Ihrer Anbieter (z. B. SOC 2, ISO 27001) überprüft?',
      options: { 'Yes': 'Ja', 'No': 'Nein' },
      remediationGuidance: 'Fordern Sie Sicherheitszertifikate (SOC 2 Typ II, ISO 27001 oder gleichwertig) von allen Anbietern an und überprüfen Sie diese.'
    },
    fr: {
      category: 'Gestion des fournisseurs',
      questionText: 'Avez-vous examiné les certifications de sécurité de vos fournisseurs (ex. SOC 2, ISO 27001) ?',
      options: { 'Yes': 'Oui', 'No': 'Non' },
      remediationGuidance: 'Demandez et examinez les certifications de sécurité (SOC 2 Type II, ISO 27001, ou équivalent) de tous les fournisseurs traitant des données personnelles.'
    }
  },
  'data-subject-rights-q1': {
    de: {
      category: 'Betroffenenrechte',
      questionText: 'Haben Sie einen Prozess, um innerhalb eines Monats zu antworten, wenn jemand per E-Mail nach seinen Daten fragt?',
      options: { 'Yes, documented process': 'Ja, dokumentierter Prozess', 'Ad-hoc process': 'Ad-hoc-Prozess', 'No': 'Nein' },
      remediationGuidance: 'Richten Sie ein dokumentiertes Verfahren für Auskunftsersuchen von Betroffenen (DSAR) ein.'
    },
    fr: {
      category: 'Droits des personnes',
      questionText: 'Si quelqu\'un demande par email "quelles données avez-vous sur moi ?", avez-vous un processus pour répondre dans un délai d\'un mois ?',
      options: { 'Yes, documented process': 'Oui, processus documenté', 'Ad-hoc process': 'Processus ad hoc', 'No': 'Non' },
      remediationGuidance: 'Établissez une procédure documentée pour les demandes d\'accès des personnes concernées (DSAR).'
    }
  },
  'data-subject-rights-q2': {
    de: {
      category: 'Betroffenenrechte',
      questionText: 'Können Sie alle Daten einer Person über alle Systeme hinweg finden und löschen, wenn diese die Löschung verlangt?',
      options: { 'Yes, across all systems': 'Ja, über alle Systeme hinweg', 'Only in our main database, not in third-party tools': 'Nur in unserer Hauptdatenbank, nicht in Tools von Drittanbietern', 'No': 'Nein' },
      remediationGuidance: 'Erstellen Sie ein dokumentiertes Löschverfahren, das jeden Speicherort abdeckt, einschließlich Drittanbieter-Tools.'
    },
    fr: {
      category: 'Droits des personnes',
      questionText: 'Pouvez-vous localiser et supprimer toutes les données d\'une personne sur tous vos systèmes si elle demande l\'effacement ?',
      options: { 'Yes, across all systems': 'Oui, sur tous les systèmes', 'Only in our main database, not in third-party tools': 'Uniquement dans notre base de données principale', 'No': 'Non' },
      remediationGuidance: 'Mettez en place une procédure d\'effacement documentée couvrant chaque emplacement, y compris les outils tiers.'
    }
  },
  'data-subject-rights-q3': {
    de: {
      category: 'Betroffenenrechte',
      questionText: 'Haben Sie einen Prozess für Anfragen zur Datenübertragbarkeit?',
      options: { 'Yes, we can export CSV/JSON': 'Ja, wir können CSV/JSON exportieren', 'No': 'Nein' },
      remediationGuidance: 'Implementieren Sie die Möglichkeit, die personenbezogenen Daten einer betroffenen Person in einem strukturierten, gängigen und maschinenlesbaren Format zu exportieren.'
    },
    fr: {
      category: 'Droits des personnes',
      questionText: 'Avez-vous un processus pour les demandes de portabilité des données ?',
      options: { 'Yes, we can export CSV/JSON': 'Oui, nous pouvons exporter en CSV/JSON', 'No': 'Non' },
      remediationGuidance: 'Mettez en œuvre la possibilité d\'exporter les données personnelles d\'une personne concernée dans un format structuré, couramment utilisé et lisible par machine.'
    }
  },
  'data-subject-rights-q4': {
    de: {
      category: 'Betroffenenrechte',
      questionText: 'Gibt es einen klaren, zugänglichen Weg für Personen, Rechteanfragen einzureichen?',
      options: { 'Yes, dedicated web form or email': 'Ja, dediziertes Webformular oder E-Mail', 'No': 'Nein' },
      remediationGuidance: 'Stellen Sie einen klar sichtbaren und leicht zugänglichen Mechanismus für Betroffenenrechteanfragen bereit.'
    },
    fr: {
      category: 'Droits des personnes',
      questionText: 'Existe-t-il un moyen clair et accessible pour soumettre des demandes de droits ?',
      options: { 'Yes, dedicated web form or email': 'Oui, formulaire web dédié ou email', 'No': 'Non' },
      remediationGuidance: 'Fournissez un mécanisme clairement visible et facilement accessible pour les demandes de droits.'
    }
  },
  'data-subject-rights-q5': {
    de: {
      category: 'Betroffenenrechte',
      questionText: 'Informieren Sie betroffene Personen über ihr Widerspruchsrecht, insbesondere bei Direktwerbung?',
      options: { 'Yes': 'Ja', 'No, but we do direct marketing': 'Nein, aber wir machen Direktwerbung', 'We don\'t do direct marketing': 'Wir machen keine Direktwerbung' },
      remediationGuidance: 'Weisen Sie betroffene Personen bei der ersten Kommunikation und in Ihrer Datenschutzerklärung ausdrücklich auf ihr Widerspruchsrecht gegen Direktwerbung hin.'
    },
    fr: {
      category: 'Droits des personnes',
      questionText: 'Informez-vous les personnes concernées de leur droit d\'opposition au traitement, en particulier pour le marketing direct ?',
      options: { 'Yes': 'Oui', 'No, but we do direct marketing': 'Non, mais nous faisons du marketing direct', 'We don\'t do direct marketing': 'Nous ne faisons pas de marketing direct' },
      remediationGuidance: 'Informez explicitement les personnes concernées de leur droit de s\'opposer au traitement à des fins de marketing direct dès la première communication.'
    }
  },
  'data-subject-rights-q6': {
    de: {
      category: 'Betroffenenrechte',
      questionText: 'Nutzen Sie automatisierte Entscheidungsfindung oder Profiling (z. B. KI-Lead-Scoring, algorithmische Einstellungen)?',
      options: { 'Yes, with human oversight and opt-outs': 'Ja, mit menschlicher Aufsicht und Opt-outs', 'Yes, fully automated without opt-outs': 'Ja, vollautomatisch ohne Opt-outs', 'No': 'Nein' },
      remediationGuidance: 'Implementieren Sie eine sinnvolle menschliche Aufsicht für alle automatisierten Entscheidungsprozesse.'
    },
    fr: {
      category: 'Droits des personnes',
      questionText: 'Utilisez-vous la prise de décision automatisée ou le profilage (ex. scoring de prospects par IA) ?',
      options: { 'Yes, with human oversight and opt-outs': 'Oui, avec supervision humaine et opt-outs', 'Yes, fully automated without opt-outs': 'Oui, entièrement automatisé sans opt-outs', 'No': 'Non' },
      remediationGuidance: 'Mettez en œuvre une supervision humaine significative pour tous les processus de prise de décision automatisée.'
    }
  },
  'security-q1': {
    de: {
      category: 'Sicherheit',
      questionText: 'Werden personenbezogene Daten in Ihren Systemen im Ruhezustand und bei der Übertragung verschlüsselt?',
      options: { 'Yes': 'Ja', 'In transit only': 'Nur bei Übertragung', 'No': 'Nein' },
      remediationGuidance: 'Implementieren Sie eine Verschlüsselung für personenbezogene Daten sowohl im Ruhezustand als auch bei der Übertragung.'
    },
    fr: {
      category: 'Sécurité',
      questionText: 'Les données personnelles sont-elles chiffrées au repos et en transit sur l\'ensemble de vos systèmes ?',
      options: { 'Yes': 'Oui', 'In transit only': 'En transit uniquement', 'No': 'Non' },
      remediationGuidance: 'Mettez en œuvre le chiffrement des données personnelles à la fois au repos et en transit.'
    }
  },
  'security-q2': {
    de: {
      category: 'Sicherheit',
      questionText: 'Haben Sie Zugriffskontrollen, die einschränken, wer in Ihrem Team personenbezogene Daten sehen darf?',
      options: { 'Yes, role-based access': 'Ja, rollenbasierter Zugriff', 'Partial — some systems have controls, others don\'t': 'Teilweise — einige Systeme haben Kontrollen', 'Everyone has access': 'Jeder hat Zugriff' },
      remediationGuidance: 'Implementieren Sie rollenbasierte Zugriffskontrollen (RBAC) in allen Systemen, die personenbezogene Daten speichern.'
    },
    fr: {
      category: 'Sécurité',
      questionText: 'Avez-vous des contrôles d\'accès limitant qui, dans votre équipe, peut voir les données personnelles ?',
      options: { 'Yes, role-based access': 'Oui, accès basé sur les rôles', 'Partial — some systems have controls, others don\'t': 'Partiel — certains systèmes ont des contrôles', 'Everyone has access': 'Tout le monde a accès' },
      remediationGuidance: 'Mettez en œuvre des contrôles d\'accès basés sur les rôles (RBAC) sur tous les systèmes stockant des données personnelles.'
    }
  },
  'security-q3': {
    de: {
      category: 'Sicherheit',
      questionText: 'Testen, bewerten und evaluieren Sie regelmäßig die Wirksamkeit Ihrer Sicherheitsmaßnahmen?',
      options: { 'Yes, regularly': 'Ja, regelmäßig', 'Rarely or ad-hoc': 'Selten oder ad-hoc', 'No': 'Nein' },
      remediationGuidance: 'Etablieren Sie einen regelmäßigen Rhythmus für Sicherheitstests, einschließlich Schwachstellen-Scans und Penetrationstests.'
    },
    fr: {
      category: 'Sécurité',
      questionText: 'Testez-vous et évaluez-vous régulièrement l\'efficacité de vos mesures de sécurité (ex. tests d\'intrusion) ?',
      options: { 'Yes, regularly': 'Oui, régulièrement', 'Rarely or ad-hoc': 'Rarement ou ad hoc', 'No': 'Non' },
      remediationGuidance: 'Établissez une cadence régulière de tests de sécurité incluant la recherche de vulnérabilités et les tests d\'intrusion.'
    }
  },
  'security-q4': {
    de: {
      category: 'Sicherheit',
      questionText: 'Haben Sie einen dokumentierten Prozess zur Meldung von Verletzungen des Schutzes an die Aufsichtsbehörde innerhalb von 72 Stunden?',
      options: { 'Yes, tested incident response plan': 'Ja, getesteter Incident-Response-Plan', 'Yes, but untested': 'Ja, aber ungetestet', 'No': 'Nein' },
      remediationGuidance: 'Dokumentieren Sie einen Reaktionsplan für Datenschutzverletzungen, der Erkennungsverfahren und Benachrichtigungsvorlagen enthält.'
    },
    fr: {
      category: 'Sécurité',
      questionText: 'Avez-vous un processus documenté pour notifier l\'autorité de contrôle dans les 72 heures en cas de violation ?',
      options: { 'Yes, tested incident response plan': 'Oui, plan de réponse aux incidents testé', 'Yes, but untested': 'Oui, mais non testé', 'No': 'Non' },
      remediationGuidance: 'Documentez un plan de réponse aux incidents de violation de données incluant les procédures de détection et les modèles de notification.'
    }
  },
  'security-q5': {
    de: {
      category: 'Sicherheit',
      questionText: 'Hat Ihr Team in den letzten 12 Monaten eine DSGVO-Schulung erhalten?',
      options: { 'Yes': 'Ja', 'No': 'Nein' },
      remediationGuidance: 'Führen Sie DSGVO-Sensibilisierungsschulungen für alle Mitarbeiter durch, die personenbezogene Daten verarbeiten.'
    },
    fr: {
      category: 'Sécurité',
      questionText: 'Votre équipe a-t-elle reçu une formation de sensibilisation au RGPD au cours des 12 derniers mois ?',
      options: { 'Yes': 'Oui', 'No': 'Non' },
      remediationGuidance: 'Dispensez une formation de sensibilisation au RGPD à tout le personnel qui manipule des données personnelles.'
    }
  },
  'privacy-notices-q1': {
    de: {
      category: 'Datenschutzerklärungen',
      questionText: 'Verfügt Ihre Website über eine Datenschutzerklärung, die in den letzten 12 Monaten aktualisiert wurde?',
      options: { 'Yes': 'Ja', 'No, it\'s older': 'Nein, sie ist älter', 'No privacy policy at all': 'Gar keine Datenschutzerklärung' },
      remediationGuidance: 'Überprüfen und aktualisieren Sie Ihre Datenschutzerklärung, um aktuelle Verarbeitungsaktivitäten widerzuspiegeln.'
    },
    fr: {
      category: 'Avis de confidentialité',
      questionText: 'Votre site web dispose-t-il d\'une politique de confidentialité qui a été mise à jour au cours des 12 derniers mois ?',
      options: { 'Yes': 'Oui', 'No, it\'s older': 'Non, elle est plus ancienne', 'No privacy policy at all': 'Aucune politique de confidentialité' },
      remediationGuidance: 'Révisez et mettez à jour votre politique de confidentialité pour refléter les activités de traitement de données actuelles.'
    }
  },
  'privacy-notices-q2': {
    de: {
      category: 'Datenschutzerklärungen',
      questionText: 'Erklärt Ihre Datenschutzerklärung alle Daten, die Sie sammeln, warum und mit wem Sie diese teilen?',
      options: { 'Yes, highly detailed': 'Ja, sehr detailliert', 'Generic template, might be missing specifics': 'Generische Vorlage', 'No': 'Nein' },
      remediationGuidance: 'Ersetzen Sie generische Vorlagen durch eine detaillierte Mitteilung, die spezifisch für Ihre Organisation ist.'
    },
    fr: {
      category: 'Avis de confidentialité',
      questionText: 'Votre politique de confidentialité explique-t-elle toutes les données que vous collectez, pourquoi, et avec qui vous les partagez ?',
      options: { 'Yes, highly detailed': 'Oui, très détaillée', 'Generic template, might be missing specifics': 'Modèle générique', 'No': 'Non' },
      remediationGuidance: 'Remplacez tout modèle générique par un avis détaillé spécifique à votre organisation.'
    }
  },
  'privacy-notices-q3': {
    de: {
      category: 'Datenschutzerklärungen',
      questionText: 'Haben Sie separate Datenschutzerklärungen für Mitarbeiter, Kunden und Website-Besucher?',
      options: { 'Yes': 'Ja', 'No, one policy for everything': 'Nein, eine für alles' },
      remediationGuidance: 'Erstellen Sie maßgeschneiderte Datenschutzerklärungen für jede Zielgruppe: Mitarbeiter, Kunden und Website-Besucher.'
    },
    fr: {
      category: 'Avis de confidentialité',
      questionText: 'Avez-vous des politiques de confidentialité séparées pour les employés, les clients et les visiteurs du site web ?',
      options: { 'Yes': 'Oui', 'No, one policy for everything': 'Non, une seule politique pour tout' },
      remediationGuidance: 'Créez des avis de confidentialité adaptés à chaque public distinct : employés, clients et visiteurs du site.'
    }
  },
  'cookie-consent-q1': {
    de: {
      category: 'Cookie-Einwilligung',
      questionText: 'Verfügt Ihre Website über ein Cookie-Einwilligungsbanner?',
      options: { 'Yes': 'Ja', 'No': 'Nein' },
      remediationGuidance: 'Implementieren Sie ein Cookie-Banner, das angezeigt wird, bevor nicht-notwendige Cookies gesetzt werden.'
    },
    fr: {
      category: 'Consentement aux cookies',
      questionText: 'Votre site web a-t-il une bannière de consentement aux cookies ?',
      options: { 'Yes': 'Oui', 'No': 'Non' },
      remediationGuidance: 'Mettez en œuvre une bannière de consentement aux cookies qui apparaît avant que des cookies non essentiels soient définis.'
    }
  },
  'cookie-consent-q2': {
    de: {
      category: 'Cookie-Einwilligung',
      questionText: 'Können Besucher alle nicht-notwendigen Cookies genauso einfach ablehnen wie akzeptieren?',
      options: { 'Yes': 'Ja', 'No, reject is hidden or requires multiple clicks': 'Nein, Ablehnen ist versteckt' },
      remediationGuidance: 'Stellen Sie sicher, dass Ihr Cookie-Banner eine Schaltfläche "Alle ablehnen" bietet, die genauso prominent ist wie "Alle akzeptieren".'
    },
    fr: {
      category: 'Consentement aux cookies',
      questionText: 'Les visiteurs peuvent-ils rejeter les cookies non essentiels aussi facilement que de les accepter ?',
      options: { 'Yes': 'Oui', 'No, reject is hidden or requires multiple clicks': 'Non, rejeter est caché' },
      remediationGuidance: 'Assurez-vous que votre bannière de cookies offre un bouton "Tout rejeter" qui est aussi visible et accessible que "Tout accepter".'
    }
  },
  'cookie-consent-q3': {
    de: {
      category: 'Cookie-Einwilligung',
      questionText: 'Blockieren Sie nicht-notwendige Cookies, bis der Benutzer seine ausdrückliche Zustimmung gibt?',
      options: { 'Yes, they are blocked until consent': 'Ja, sie sind blockiert', 'Not sure': 'Nicht sicher', 'No, they fire immediately': 'Nein, sie werden sofort ausgeführt' },
      remediationGuidance: 'Konfigurieren Sie Ihre Cookie-Einwilligung so, dass alle nicht-notwendigen Cookies blockiert werden, bis die Einwilligung vorliegt.'
    },
    fr: {
      category: 'Consentement aux cookies',
      questionText: 'Bloquez-vous les cookies non essentiels jusqu\'à ce que l\'utilisateur donne son consentement explicite ?',
      options: { 'Yes, they are blocked until consent': 'Oui, ils sont bloqués', 'Not sure': 'Pas sûr', 'No, they fire immediately': 'Non, ils s\'exécutent immédiatement' },
      remediationGuidance: 'Configurez votre implémentation du consentement aux cookies pour bloquer tous les cookies non essentiels jusqu\'à ce que l\'utilisateur ait donné un consentement explicite.'
    }
  },
  'cookie-consent-q4': {
    de: {
      category: 'Cookie-Einwilligung',
      questionText: 'Haben Sie eine Aufzeichnung der von Besuchern erteilten Cookie-Einwilligungen?',
      options: { 'Yes, stored securely': 'Ja, sicher gespeichert', 'No': 'Nein' },
      remediationGuidance: 'Implementieren Sie einen Protokollierungsmechanismus, der die Einwilligungsentscheidung jedes Besuchers aufzeichnet.'
    },
    fr: {
      category: 'Consentement aux cookies',
      questionText: 'Avez-vous un registre des consentements aux cookies donnés par les visiteurs ?',
      options: { 'Yes, stored securely': 'Oui, stocké de manière sécurisée', 'No': 'Non' },
      remediationGuidance: 'Mettez en œuvre un mécanisme de journalisation des consentements qui enregistre la décision de chaque visiteur.'
    }
  },
  'governance-q1': {
    de: {
      category: 'Governance',
      questionText: 'Haben Sie einen Datenschutzbeauftragten (DSB) benannt, wie in Artikel 37 gefordert?',
      options: { 'Yes': 'Ja', 'No, but we process large-scale sensitive data/monitor users': 'Nein, aber wir verarbeiten in großem Umfang sensible Daten', 'No, we are not required to': 'Nein, wir sind nicht dazu verpflichtet' },
      remediationGuidance: 'Prüfen Sie, ob Ihre Organisation einen DSB benennen muss. Falls ja, benennen Sie formell einen DSB.'
    },
    fr: {
      category: 'Gouvernance',
      questionText: 'Avez-vous nommé un Délégué à la Protection des Données (DPO) tel que requis par l\'article 37 ?',
      options: { 'Yes': 'Oui', 'No, but we process large-scale sensitive data/monitor users': 'Non, mais nous traitons des données sensibles à grande échelle', 'No, we are not required to': 'Non, nous n\'y sommes pas tenus' },
      remediationGuidance: 'Évaluez si votre organisation est tenue de nommer un DPO. Si c\'est le cas, désignez officiellement un DPO.'
    }
  },
  'governance-q2': {
    de: {
      category: 'Governance',
      questionText: 'Haben Sie Datenschutz-Folgenabschätzungen (DSFA) für Ihre risikoreichen Verarbeitungen durchgeführt?',
      options: { 'Yes': 'Ja', 'No, but we do high-risk processing': 'Nein, aber wir führen risikoreiche Verarbeitungen durch', 'We don\'t have high-risk activities': 'Wir haben keine risikoreichen Aktivitäten' },
      remediationGuidance: 'Identifizieren Sie alle Verarbeitungsaktivitäten, die voraussichtlich ein hohes Risiko für Personen mit sich bringen, und führen Sie für jede eine DSFA durch.'
    },
    fr: {
      category: 'Gouvernance',
      questionText: 'Avez-vous réalisé des Analyses d\'Impact sur la Protection des Données (AIPD) pour vos activités à haut risque ?',
      options: { 'Yes': 'Oui', 'No, but we do high-risk processing': 'Non, mais nous faisons des traitements à haut risque', 'We don\'t have high-risk activities': 'Nous n\'avons pas d\'activités à haut risque' },
      remediationGuidance: 'Identifiez toutes les activités de traitement susceptibles d\'engendrer un risque élevé pour les personnes et réalisez une AIPD pour chacune d\'elles.'
    }
  },
  'governance-q3': {
    de: {
      category: 'Governance',
      questionText: 'Führen Sie ein formelles Verzeichnis von Verarbeitungstätigkeiten (VVT)?',
      options: { 'Yes, fully up-to-date': 'Ja, vollständig auf dem neuesten Stand', 'Partially or outdated': 'Teilweise oder veraltet', 'No': 'Nein' },
      remediationGuidance: 'Erstellen und pflegen Sie ein Verzeichnis von Verarbeitungstätigkeiten (VVT) gemäß Artikel 30.'
    },
    fr: {
      category: 'Gouvernance',
      questionText: 'Tenez-vous un Registre des Activités de Traitement (ROPA) formel cartographiant quelles données vous traitez, pourquoi et où elles vont ?',
      options: { 'Yes, fully up-to-date': 'Oui, entièrement à jour', 'Partially or outdated': 'Partiellement ou obsolète', 'No': 'Non' },
      remediationGuidance: 'Créez et maintenez un Registre des Activités de Traitement (ROPA) tel que requis par l\'article 30.'
    }
  },
  'client-compliance-q1': {
    de: {
      category: 'Kunden-Compliance',
      questionText: 'Verarbeiten Sie Patientenakten / Gesundheitsdaten?',
      options: { 'Yes': 'Ja', 'No': 'Nein' },
      remediationGuidance: 'Wenn Sie Gesundheitsdaten verarbeiten, stellen Sie sicher, dass Sie eine gültige Rechtsgrundlage gemäß Artikel 6 und eine Ausnahme gemäß Artikel 9(2) haben.'
    },
    fr: {
      category: 'Conformité client',
      questionText: 'Traitez-vous des dossiers de santé de patients ?',
      options: { 'Yes': 'Oui', 'No': 'Non' },
      remediationGuidance: 'Si vous traitez des données de santé, assurez-vous d\'avoir identifié une base légale valide selon l\'article 6 et une exemption spécifique de l\'article 9(2).'
    }
  },
  'client-compliance-q2': {
    de: {
      category: 'Kunden-Compliance',
      questionText: 'Haben Sie eine gültige Grundlage gemäß Artikel 9 Absatz 2 für die Verarbeitung dieser Daten?',
      options: { 'Yes': 'Ja', 'No': 'Nein' },
      remediationGuidance: 'Identifizieren und dokumentieren Sie eine spezifische Ausnahme gemäß Artikel 9 Absatz 2 für jede Verarbeitung besonderer Datenkategorien.'
    },
    fr: {
      category: 'Conformité client',
      questionText: 'Avez-vous identifié une base valide selon l\'article 9(2) pour traiter ces données de catégorie particulière ?',
      options: { 'Yes': 'Oui', 'No': 'Non' },
      remediationGuidance: 'Identifiez et documentez une exemption spécifique de l\'article 9(2) pour chaque instance de traitement de données de catégorie particulière.'
    }
  },
  'client-compliance-q3': {
    de: {
      category: 'Kunden-Compliance',
      questionText: 'Haben Sie für diese Gesundheitsdatenverarbeitung eine Datenschutz-Folgenabschätzung (DSFA) durchgeführt?',
      options: { 'Yes': 'Ja', 'No': 'Nein' },
      remediationGuidance: 'Führen Sie eine Datenschutz-Folgenabschätzung speziell für Ihre Verarbeitung von Gesundheitsdaten durch.'
    },
    fr: {
      category: 'Conformité client',
      questionText: 'Avez-vous réalisé une Analyse d\'Impact (AIPD) pour ce traitement de données de santé ?',
      options: { 'Yes': 'Oui', 'No': 'Non' },
      remediationGuidance: 'Réalisez une Analyse d\'Impact sur la Protection des Données spécifiquement pour vos activités de traitement de données de santé.'
    }
  },
  'client-compliance-q4': {
    de: {
      category: 'Kunden-Compliance',
      questionText: 'Verarbeiten Sie Zahlungskartendaten?',
      options: { 'Yes': 'Ja', 'No': 'Nein' },
      remediationGuidance: 'Wenn Sie Zahlungskartendaten verarbeiten, implementieren Sie erweiterte Sicherheitsmaßnahmen wie PCI-DSS-Compliance.'
    },
    fr: {
      category: 'Conformité client',
      questionText: 'Traitez-vous des données de cartes de paiement ?',
      options: { 'Yes': 'Oui', 'No': 'Non' },
      remediationGuidance: 'Si vous traitez des données de cartes de paiement, mettez en œuvre des mesures de sécurité renforcées incluant la conformité PCI-DSS.'
    }
  },
  'client-compliance-q5': {
    de: {
      category: 'Kunden-Compliance',
      questionText: 'Haben Sie erweiterte Sicherheitsmaßnahmen (z. B. PCI-DSS-Compliance) zum Schutz dieser Daten implementiert?',
      options: { 'Yes': 'Ja', 'No': 'Nein' },
      remediationGuidance: 'Erreichen und erhalten Sie die PCI-DSS-Konformität für alle Systeme, die Zahlungskartendaten verarbeiten.'
    },
    fr: {
      category: 'Conformité client',
      questionText: 'Avez-vous mis en œuvre des mesures de sécurité renforcées (ex. conformité PCI-DSS) pour protéger ces données financières ?',
      options: { 'Yes': 'Oui', 'No': 'Non' },
      remediationGuidance: 'Atteignez et maintenez la conformité PCI-DSS pour tous les systèmes qui stockent ou traitent des données de cartes de paiement.'
    }
  },
  'client-compliance-q6': {
    de: {
      category: 'Kunden-Compliance',
      questionText: 'Wenn Sie als Auftragsverarbeiter für Kunden tätig sind, haben Sie mit jedem Kunden einen AVV abgeschlossen?',
      options: { 'Yes, all clients': 'Ja, alle Kunden', 'Some clients': 'Einige Kunden', 'No': 'Nein' },
      remediationGuidance: 'Schließen Sie mit jedem Kunden, für den Sie als Auftragsverarbeiter tätig sind, einen Auftragsverarbeitungsvertrag ab.'
    },
    fr: {
      category: 'Conformité client',
      questionText: 'Lorsque vous agissez en tant que sous-traitant, avez-vous des DPA en place avec chaque client ?',
      options: { 'Yes, all clients': 'Oui, tous les clients', 'Some clients': 'Certains clients', 'No': 'Non' },
      remediationGuidance: 'Concluez des Accords de Traitement des Données avec chaque client pour lequel vous agissez en tant que sous-traitant.'
    }
  },
  'client-compliance-q7': {
    de: {
      category: 'Kunden-Compliance',
      questionText: 'Können Sie Kunden oder Partnern, die danach fragen, Ihre DSGVO-Konformität nachweisen?',
      options: { 'Yes, with a dashboard or compiled report': 'Ja, mit einem Dashboard oder Bericht', 'Yes, but it takes hours to compile manually': 'Ja, aber manuell dauert es Stunden', 'No': 'Nein' },
      remediationGuidance: 'Richten Sie einen Rechenschaftsrahmen ein, der es Ihnen ermöglicht, die DSGVO-Konformität auf Anfrage nachzuweisen.'
    },
    fr: {
      category: 'Conformité client',
      questionText: 'Pouvez-vous démontrer votre conformité au RGPD aux clients ou partenaires qui le demandent ?',
      options: { 'Yes, with a dashboard or compiled report': 'Oui, avec un tableau de bord ou rapport compilé', 'Yes, but it takes hours to compile manually': 'Oui, mais cela prend des heures', 'No': 'Non' },
      remediationGuidance: 'Établissez un cadre de responsabilité qui vous permet de démontrer votre conformité au RGPD sur demande.'
    }
  }
};
