export type ContactSearchResult = {
  id: string;
  fields: Record<string, any>;
  createdAt: string;
  updatedAt: string;
};

export type DocumentSearchResult = {
  id: string;
  title: string;
  url: string;
  createdAt: string;
  updatedAt: string;
};

export type ProviderConfig = {
  id: string;
  name: string;
  icon: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  extraAuthParams?: Record<string, string>;
  // Provider-specific functions
  extractAccountInfo: (tokenResponse: any) => { accountId: string; accountName: string };
  searchContacts: (accessToken: string, email: string) => Promise<ContactSearchResult[]>;
  searchDocuments?: (accessToken: string, query: string) => Promise<DocumentSearchResult[]>;
  discoverDataProfile?: (accessToken: string) => Promise<any>;
};

export const PROVIDERS: Record<string, ProviderConfig> = {
  hubspot: {
    id: 'hubspot',
    name: 'HubSpot',
    icon: 'hubspot-icon',
    authUrl: 'https://app.hubspot.com/oauth/authorize',
    tokenUrl: 'https://api.hubapi.com/oauth/v1/token',
    scopes: ['crm.objects.contacts.read', 'crm.objects.companies.read'],
    extractAccountInfo: (tokenResponse: any) => {
      // In a real implementation, you might need to make an API call to get the portal name
      // For now, we'll just extract what we can or mock it if not available in the token response
      return {
        accountId: tokenResponse.hub_id || 'unknown_hub_id',
        accountName: `HubSpot Portal ${tokenResponse.hub_id || 'Unknown'}`
      };
    },
    searchContacts: async (accessToken: string, email: string) => {
      const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filterGroups: [{
            filters: [{ propertyName: 'email', operator: 'EQ', value: email }]
          }]
        })
      });

      if (!res.ok) {
        throw new Error(`HubSpot API error: ${res.statusText}`);
      }

      const data = await res.json();
      return data.results.map((r: any) => ({
        id: r.id,
        fields: r.properties,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt
      }));
    }
  },
  salesforce: {
    id: 'salesforce',
    name: 'Salesforce',
    icon: 'salesforce-icon',
    authUrl: 'https://login.salesforce.com/services/oauth2/authorize',
    tokenUrl: 'https://login.salesforce.com/services/oauth2/token',
    scopes: ['api', 'refresh_token'],
    extractAccountInfo: (tokenResponse: any) => {
      return {
        accountId: tokenResponse.id || 'unknown_sf_id',
        accountName: `Salesforce Org ${tokenResponse.id ? tokenResponse.id.split('/').pop() : 'Unknown'}`
      };
    },
    searchContacts: async (accessToken: string, email: string) => {
      // Stub implementation. Salesforce requires the instance_url from the token response
      // For a full implementation, you'd store instanceUrl alongside the token.
      return [];
    }
  },
  google_workspace: {
    id: 'google_workspace',
    name: 'Google Workspace',
    icon: 'google-icon',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/gmail.readonly',
    ],
    extraAuthParams: { access_type: 'offline', prompt: 'consent' },
    extractAccountInfo: (tokenResponse: any) => {
       // Mocked. Would decode id_token to get email/domain
      return { accountId: 'google-domain', accountName: 'Google Workspace' };
    },
    searchContacts: async () => [],
    searchDocuments: async (accessToken: string, query: string) => {
      // Stub implementation
      return [];
    }
  },
  mailchimp: {
    id: 'mailchimp',
    name: 'Mailchimp',
    icon: 'mailchimp-icon',
    authUrl: 'https://login.mailchimp.com/oauth2/authorize',
    tokenUrl: 'https://login.mailchimp.com/oauth2/token',
    scopes: [],
    extractAccountInfo: (tokenResponse: any) => {
      // Mailchimp returns a dc (data center) parameter
      return { accountId: tokenResponse.dc || 'unknown_dc', accountName: 'Mailchimp Account' };
    },
    searchContacts: async (accessToken: string, email: string) => {
      // Stub implementation
      return [];
    }
  }
};
