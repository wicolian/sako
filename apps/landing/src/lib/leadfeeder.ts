/**
 * Leadfeeder API client
 * @see https://docs.leadfeeder.com/api/
 *
 * Requires Trial or Premium account. Free plan has NO API access.
 */

const API_BASE = 'https://api.leadfeeder.com';

export type LeadfeederAccount = {
  id: string;
  name: string;
  subscription: 'lite' | 'premium';
  timezone: string;
  website_tracking_status: 'not_installed' | 'reporting' | 'ok';
};

export type LeadfeederLocation = {
  id: string;
  country: string;
  country_code: string;
  region: string | null;
  city: string;
  state_code: string | null;
};

export type LeadfeederLead = {
  id: string;
  name: string;
  industry: string;
  industries?: Array<{ name: string }>;
  first_visit_date: string;
  last_visit_date: string;
  status: string;
  website_url: string | null;
  phone: string | null;
  linkedin_url: string | null;
  twitter_handle: string | null;
  facebook_url: string | null;
  employee_count?: number;
  employees_range?: { min: number | null; max: number | null };
  logo_url: string | null;
  quality: number;
  visits: number;
  view_in_leadfeeder: string;
  location?: LeadfeederLocation;
};

export type LeadfeederCustomFeed = {
  id: string;
  name: string;
  criteria: Array<{
    criterion_type: string;
    search_value: string | number;
    display_value: string;
    excluded?: boolean;
  }>;
};

export type LeadfeederVisit = {
  id: string;
  source: string | null;
  medium: string | null;
  landing_page_path: string;
  visit_route: Array<{
    page_path: string;
    page_title: string;
    time_on_page: number;
  }>;
  visit_length: number;
  started_at: string;
  lead_id: string;
};

export type LeadfeederApiResponse<T> = {
  data: T;
  included?: unknown[];
  links?: { self?: string; next?: string; last?: string };
};

function getToken(): string {
  const token = process.env.LEADFEEDER_API_TOKEN;
  if (!token) {
    throw new Error(
      'LEADFEEDER_API_TOKEN is required. Add it to .env.local (API requires Trial or Premium)'
    );
  }
  return token;
}

async function fetchApi<T>(
  path: string,
  options?: { method?: string; body?: string; params?: Record<string, string> }
): Promise<T> {
  const token = getToken();
  const params = options?.params;
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  const url = `${API_BASE}${path}${qs}`;

  const res = await fetch(url, {
    method: options?.method ?? 'GET',
    headers: {
      Authorization: `Token token=${token}`,
      'User-Agent': 'Sako-Marketing/1.0',
      'Content-Type': 'application/json',
    },
    ...(options?.body && { body: options.body }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = (data as { errors?: Array<{ title?: string }> })?.errors?.[0];
    if (res.status === 402) {
      throw new Error(
        'Leadfeeder API requires Premium (or active Trial). Free plan has no API access.'
      );
    }
    if (res.status === 429) {
      throw new Error('Leadfeeder API rate limit (100 req/min). Try again later.');
    }
    throw new Error(err?.title || `Leadfeeder API error: ${res.status}`);
  }

  return data as T;
}

/** Get all accounts the API token can access */
export async function getAccounts(): Promise<LeadfeederAccount[]> {
  const res = await fetchApi<LeadfeederApiResponse<LeadfeederAccount[]>>(
    '/accounts'
  );
  return res.data ?? [];
}

/** Get a specific account */
export async function getAccount(
  accountId: string
): Promise<LeadfeederAccount> {
  const res = await fetchApi<LeadfeederApiResponse<LeadfeederAccount>>(
    `/accounts/${accountId}`
  );
  return res.data;
}

/** Get custom feeds for an account */
export async function getCustomFeeds(
  accountId: string
): Promise<LeadfeederCustomFeed[]> {
  const res = await fetchApi<
    LeadfeederApiResponse<LeadfeederCustomFeed[]>
  >(`/accounts/${accountId}/custom-feeds`);
  return res.data ?? [];
}

/** Get leads for an account (date range required) */
export async function getLeads(
  accountId: string,
  startDate: string,
  endDate: string,
  options?: { customFeedId?: string; page?: number; pageSize?: number }
): Promise<{
  leads: LeadfeederLead[];
  included?: LeadfeederLocation[];
  links?: { next?: string; last?: string };
}> {
  const params: Record<string, string> = {
    start_date: startDate,
    end_date: endDate,
  };
  if (options?.page) params['page[number]'] = String(options.page);
  if (options?.pageSize) params['page[size]'] = String(options.pageSize);

  const path = options?.customFeedId
    ? `/accounts/${accountId}/custom-feeds/${options.customFeedId}/leads`
    : `/accounts/${accountId}/leads`;

  const res = await fetchApi<LeadfeederApiResponse<LeadfeederLead[]>>(
    path,
    { params }
  );
  return {
    leads: res.data ?? [],
    included: res.included as LeadfeederLocation[] | undefined,
    links: res.links,
  };
}

/** Get a single lead */
export async function getLead(
  accountId: string,
  leadId: string
): Promise<LeadfeederLead> {
  const res = await fetchApi<LeadfeederApiResponse<LeadfeederLead>>(
    `/accounts/${accountId}/leads/${encodeURIComponent(leadId)}`
  );
  return res.data;
}

/** Get visits for a lead */
export async function getLeadVisits(
  accountId: string,
  leadId: string,
  startDate: string,
  endDate: string
): Promise<LeadfeederVisit[]> {
  const res = await fetchApi<
    LeadfeederApiResponse<LeadfeederVisit[]>
  >(
    `/accounts/${accountId}/leads/${encodeURIComponent(leadId)}/visits`,
    { params: { start_date: startDate, end_date: endDate } }
  );
  return res.data ?? [];
}

/** Get all visits for an account */
export async function getAllVisits(
  accountId: string,
  startDate: string,
  endDate: string,
  options?: { page?: number; pageSize?: number }
): Promise<{
  visits: LeadfeederVisit[];
  included?: LeadfeederLocation[];
}> {
  const params: Record<string, string> = {
    start_date: startDate,
    end_date: endDate,
  };
  if (options?.page) params['page[number]'] = String(options.page);
  if (options?.pageSize) params['page[size]'] = String(options.pageSize);

  const res = await fetchApi<LeadfeederApiResponse<LeadfeederVisit[]>>(
    `/accounts/${accountId}/visits`,
    { params }
  );
  return {
    visits: res.data ?? [],
    included: res.included as LeadfeederLocation[] | undefined,
  };
}

/** Request a feed export (async - poll status, then download). Max 5 requests/min. */
export async function requestFeedExport(
  accountId: string,
  customFeedId: string,
  startDate: string,
  endDate: string
): Promise<{ id: string; status: string; status_url: string; download_url: string | null }> {
  const token = getToken();
  const body = new URLSearchParams({
    account_id: accountId,
    custom_feed_id: customFeedId,
    start_date: startDate,
    end_date: endDate,
  }).toString();

  const res = await fetch(`${API_BASE}/export-requests`, {
    method: 'POST',
    headers: {
      Authorization: `Token token=${token}`,
      'User-Agent': 'Sako-Marketing/1.0',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const json = (await res.json().catch(() => ({}))) as {
    data?: { id?: string; attributes?: { status?: string; status_url?: string; download_url?: string | null } };
    errors?: Array<{ title?: string }>;
  };

  if (!res.ok) {
    throw new Error(json.errors?.[0]?.title || `Export request failed: ${res.status}`);
  }

  const d = json.data;
  return {
    id: d?.id ?? '',
    status: d?.attributes?.status ?? 'pending',
    status_url: d?.attributes?.status_url ?? '',
    download_url: d?.attributes?.download_url ?? null,
  };
}

/** Get export request status */
export async function getExportStatus(
  exportId: string
): Promise<{ status: string; download_url: string | null }> {
  const res = await fetchApi<{ data?: { attributes?: { status?: string; download_url?: string | null } } }>(
    `/export-requests/${exportId}`
  );
  const attrs = res.data?.attributes;
  return {
    status: attrs?.status ?? 'pending',
    download_url: attrs?.download_url ?? null,
  };
}
