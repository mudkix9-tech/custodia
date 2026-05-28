export const defaultTrainingModules = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    organizationId: null,
    isGlobal: true,
    title: 'GDPR Fundamentals',
    description: 'Required for all staff. Covers the core concepts, principles, and rights under the GDPR.',
    targetRole: 'all',
    isMandatory: true,
    passingScore: 70,
    recurrence: 'annual',
    status: 'published',
    content: [
      {
        id: 'slide-1-1',
        type: 'text',
        title: 'What is GDPR and Why It Matters',
        content: 'The General Data Protection Regulation (GDPR) is the toughest privacy and security law in the world. It protects the personal data of individuals in the EU. It matters because non-compliance can lead to massive fines (up to €20M or 4% of global revenue) and severe reputational damage to our organization and our clients.',
        estimatedMinutes: 2
      },
      {
        id: 'slide-1-2',
        type: 'key_point',
        title: 'Key GDPR Principles',
        keyPoints: [
          'Lawfulness, fairness and transparency',
          'Purpose limitation',
          'Data minimization',
          'Accuracy',
          'Storage limitation',
          'Integrity and confidentiality (security)',
          'Accountability'
        ],
        estimatedMinutes: 3
      },
      {
        id: 'slide-1-3',
        type: 'text',
        title: 'What Counts as Personal Data?',
        content: 'Personal data is any information relating to an identified or identifiable living person. This includes names, email addresses, location data, online identifiers (IP addresses, cookies), and even physical characteristics. In our day-to-day work, this commonly appears in databases, marketing lists, and web analytics.',
        estimatedMinutes: 2
      },
      {
        id: 'slide-1-4',
        type: 'text',
        title: 'Special Category Data',
        content: 'Some data is considered more sensitive and requires higher protection. This includes race, ethnic origin, political opinions, religious beliefs, trade union membership, genetics, biometrics, health data, and sexual orientation. We generally should avoid processing this data unless absolutely necessary.',
        estimatedMinutes: 2
      },
      {
        id: 'slide-1-5',
        type: 'text',
        title: 'The Six Lawful Bases',
        content: 'You must have a valid lawful basis to process personal data: \n1. Consent\n2. Contractual necessity\n3. Legal obligation\n4. Vital interests\n5. Public task\n6. Legitimate interests.',
        estimatedMinutes: 3
      },
      {
        id: 'slide-1-6',
        type: 'text',
        title: 'Data Subject Rights',
        content: 'Individuals have rights over their data, including the right to access, rectify, erase ("right to be forgotten"), restrict processing, port their data, and object to processing. If you receive a request, it must be handled within 30 days.',
        estimatedMinutes: 3
      }
    ],
    quiz: {
      questions: [
        {
          id: 'q-1-1',
          question: 'What is the maximum fine for a severe GDPR violation?',
          options: [
            { id: 'o-1-1-a', text: '€10M or 2% of global revenue', correct: false },
            { id: 'o-1-1-b', text: '€20M or 4% of global revenue', correct: true },
            { id: 'o-1-1-c', text: '€1M', correct: false },
            { id: 'o-1-1-d', text: 'There are no financial penalties', correct: false }
          ],
          explanation: 'Under GDPR Article 83, the highest tier of administrative fines can be up to €20 million, or 4% of the firm’s worldwide annual revenue from the preceding financial year, whichever is higher.',
          articleReference: 'Article 83'
        },
        {
          id: 'q-1-2',
          question: 'Which of the following is considered "Special Category" data?',
          options: [
            { id: 'o-1-2-a', text: 'A person\'s business email address', correct: false },
            { id: 'o-1-2-b', text: 'A person\'s biometric data (e.g., fingerprint)', correct: true },
            { id: 'o-1-2-c', text: 'A person\'s job title', correct: false },
            { id: 'o-1-2-d', text: 'A person\'s IP address', correct: false }
          ],
          explanation: 'Special category data includes sensitive information like biometrics, health data, race, and religious beliefs.',
          articleReference: 'Article 9'
        },
        {
          id: 'q-1-3',
          question: 'How long do you have to respond to a Data Subject Access Request (DSAR)?',
          options: [
            { id: 'o-1-3-a', text: '7 days', correct: false },
            { id: 'o-1-3-b', text: '30 days (1 month)', correct: true },
            { id: 'o-1-3-c', text: '90 days', correct: false },
            { id: 'o-1-3-d', text: 'No specific time limit', correct: false }
          ],
          explanation: 'GDPR requires organizations to respond to a DSAR without undue delay and at the latest within one month of receipt.',
          articleReference: 'Article 12'
        }
      ]
    }
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    organizationId: null,
    isGlobal: true,
    title: 'Data Handling Best Practices',
    description: 'How to compliantly process data day-to-day using various tools and platforms.',
    targetRole: 'all',
    isMandatory: true,
    passingScore: 70,
    recurrence: 'annual',
    status: 'published',
    content: [
      {
        id: 'slide-2-1',
        type: 'text',
        title: 'Client Data vs Internal Data',
        content: 'When we handle client data (e.g., running a marketing campaign for their customers), we act as a Data Processor. When we handle our own data (e.g., our employees or our own sales leads), we act as a Data Controller. Our obligations differ depending on the role.',
        estimatedMinutes: 2
      },
      {
        id: 'slide-2-2',
        type: 'scenario',
        title: 'Using Third-Party Tools',
        scenario: {
          situation: 'You want to try a new AI analytics tool and need to upload a client\'s customer list to test it.',
          options: [
            {
              text: 'Go ahead, it\'s just for testing.',
              correct: false,
              explanation: 'Incorrect. You cannot share client data with a new sub-processor without the client\'s permission and a signed DPA with the tool provider.'
            },
            {
              text: 'Ask the DPO or compliance lead first to ensure we have a DPA and client authorization.',
              correct: true,
              explanation: 'Correct! Any new tool handling personal data must be vetted and documented.'
            }
          ]
        },
        estimatedMinutes: 3
      }
    ],
    quiz: {
      questions: [
        {
          id: 'q-2-1',
          question: 'If a client asks us to run an email campaign to their list, what is our GDPR role?',
          options: [
            { id: 'o-2-1-a', text: 'Data Controller', correct: false },
            { id: 'o-2-1-b', text: 'Data Processor', correct: true },
            { id: 'o-2-1-c', text: 'Joint Controller', correct: false },
            { id: 'o-2-1-d', text: 'Data Subject', correct: false }
          ],
          explanation: 'Because we are processing the data on behalf of the client (who decides the purpose), we are the Data Processor.',
          articleReference: 'Article 28'
        }
      ]
    }
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    organizationId: null,
    isGlobal: true,
    title: 'Data Breach Response',
    description: 'Learn how to recognize a data breach and the critical steps for reporting it.',
    targetRole: 'all',
    isMandatory: true,
    passingScore: 80,
    recurrence: 'annual',
    status: 'published',
    content: [
      {
        id: 'slide-3-1',
        type: 'text',
        title: 'What Counts as a Data Breach?',
        content: 'A personal data breach means a breach of security leading to the accidental or unlawful destruction, loss, alteration, unauthorized disclosure of, or access to, personal data. This isn\'t just hackers—sending an email with personal data to the wrong person is a breach.',
        estimatedMinutes: 2
      },
      {
        id: 'slide-3-2',
        type: 'key_point',
        title: 'The 72-Hour Timeline',
        keyPoints: [
          'If we act as a Controller, we must notify the supervisory authority within 72 hours of becoming aware of the breach.',
          'If we act as a Processor, we must notify our Client (the Controller) without undue delay.',
          'Internal reporting must happen IMMEDIATELY to allow the DPO to meet these deadlines.'
        ],
        estimatedMinutes: 3
      }
    ],
    quiz: {
      questions: [
        {
          id: 'q-3-1',
          question: 'You accidentally email a spreadsheet of client customer data to the wrong client. What should you do?',
          options: [
            { id: 'o-3-1-a', text: 'Ignore it and hope they delete it.', correct: false },
            { id: 'o-3-1-b', text: 'Email them asking to delete it, but don\'t tell anyone else.', correct: false },
            { id: 'o-3-1-c', text: 'Report it immediately to your DPO or compliance officer.', correct: true },
            { id: 'o-3-1-d', text: 'Wait until the end of the week to see if anything bad happens.', correct: false }
          ],
          explanation: 'Accidental disclosure is a data breach. You must report it internally immediately so the 72-hour window for official reporting can be met.',
          articleReference: 'Article 33'
        }
      ]
    }
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    organizationId: null,
    isGlobal: true,
    title: 'Security Awareness',
    description: 'Best practices for securing devices, recognizing phishing, and maintaining password hygiene.',
    targetRole: 'all',
    isMandatory: true,
    passingScore: 70,
    recurrence: 'annual',
    status: 'published',
    content: [
      {
        id: 'slide-4-1',
        type: 'text',
        title: 'Password Hygiene',
        content: 'Always use a password manager. Never reuse passwords across different services. Enable Multi-Factor Authentication (MFA) on all accounts that support it.',
        estimatedMinutes: 2
      },
      {
        id: 'slide-4-2',
        type: 'scenario',
        title: 'Phishing Recognition',
        scenario: {
          situation: 'You receive an urgent email from "The CEO" asking you to purchase gift cards and reply with the codes.',
          options: [
            {
              text: 'Do it immediately, it\'s the CEO!',
              correct: false,
              explanation: 'Incorrect. This is a common social engineering tactic known as CEO Fraud or Whaling.'
            },
            {
              text: 'Verify the request via a different communication channel (e.g., Slack or a phone call) before taking action.',
              correct: true,
              explanation: 'Correct! Always verify unusual or urgent financial requests through a secondary channel.'
            }
          ]
        },
        estimatedMinutes: 3
      }
    ],
    quiz: {
      questions: [
        {
          id: 'q-4-1',
          question: 'Why should you avoid using public Wi-Fi without a VPN when handling client data?',
          options: [
            { id: 'o-4-1-a', text: 'It\'s too slow.', correct: false },
            { id: 'o-4-1-b', text: 'Public Wi-Fi networks can be intercepted, exposing data in transit.', correct: true },
            { id: 'o-4-1-c', text: 'It uses too much battery.', correct: false },
            { id: 'o-4-1-d', text: 'You might get blocked by the client\'s firewall.', correct: false }
          ],
          explanation: 'Unsecured networks allow attackers to perform Man-in-the-Middle (MitM) attacks to steal sensitive data.',
          articleReference: 'Article 32'
        }
      ]
    }
  },
  {
    id: '55555555-5555-5555-5555-555555555555',
    organizationId: null,
    isGlobal: true,
    title: 'Processing Data on Behalf of Others',
    description: 'Rules for managing data minimization, retention, and DPAs when processing data on behalf of others.',
    targetRole: 'all',
    isMandatory: true,
    passingScore: 70,
    recurrence: 'annual',
    status: 'published',
    content: [
      {
        id: 'slide-5-1',
        type: 'text',
        title: 'Data Minimization in Projects',
        content: 'When starting a new client project, only request the data absolutely necessary to perform the work. If you only need email addresses to send a newsletter, do not ask the client for their full CRM export containing physical addresses and purchase history.',
        estimatedMinutes: 3
      },
      {
        id: 'slide-5-2',
        type: 'text',
        title: 'Returning or Deleting Data',
        content: 'When a contract ends, or when data is no longer needed for the project, we must securely delete or return the data to the client, as stipulated in the Data Processing Agreement (DPA).',
        estimatedMinutes: 2
      }
    ],
    quiz: {
      questions: [
        {
          id: 'q-5-1',
          question: 'A client sends you their entire customer database for a campaign that only requires email addresses. What should you do?',
          options: [
            { id: 'o-5-1-a', text: 'Store it on your laptop just in case you need it later.', correct: false },
            { id: 'o-5-1-b', text: 'Delete the unnecessary fields immediately and inform the client of data minimization principles.', correct: true },
            { id: 'o-5-1-c', text: 'Upload the whole file to Mailchimp anyway.', correct: false },
            { id: 'o-5-1-d', text: 'Share it with your coworkers to look at.', correct: false }
          ],
          explanation: 'Under the principle of Data Minimization, you should only process what is strictly necessary. Informing the client helps them improve their own compliance.',
          articleReference: 'Article 5'
        }
      ]
    }
  }
];
