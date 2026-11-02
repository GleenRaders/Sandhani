import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
for (const scope of SCOPES) {
  provider.addScope(scope);
}

// In-memory access token cache (never stored in localStorage/sessionStorage per workspace-integration skill)
let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initGoogleSheetsAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignInForSheets = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to obtain Google Sheets access token from sign-in.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error('Google Sheets Sign-In error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getSheetsAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const googleSheetsLogout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

export interface BackupPayloadSnapshot {
  generatedAt: string;
  donors: {
    name: string;
    bloodGroup: string;
    phone: string;
    email: string;
    unit: string;
    lastDonationDate: string | null;
    isAvailable: boolean;
  }[];
  requisitions: {
    id: string;
    patient: string;
    bloodGroup: string;
    units: number;
    hospital: string;
    urgency: string;
    phone: string;
    status: string;
    createdAt: string;
  }[];
  fridgeBags: {
    serialNumber: string;
    bloodGroup: string;
    collectionDate: string;
    expiryDate: string;
    volumeMl: number;
    compartment: string;
    status: string;
  }[];
  vaccines: {
    name: string;
    priceBdt: number;
    totalDoses: number;
    stockCount: number;
    scheduleText: string;
  }[];
  members: {
    name: string;
    designation: string;
    phone: string;
    bloodGroup: string;
    batch: string;
  }[];
}

export function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) return match[1];
  return trimmed;
}

function buildCombinedSheetRows(snapshot: BackupPayloadSnapshot): (string | number)[][] {
  const rows: (string | number)[][] = [
    ['SANDHANI RAJSHAHI MEDICAL COLLEGE UNIT — MASTER CLINICAL BACKUP'],
    ['Generated At (UTC)', snapshot.generatedAt],
    [],
    ['=== 1. BLOOD FRIDGE INVENTORY (ACTIVE & LOGGED BAGS) ==='],
    ['Serial Number', 'Blood Group', 'Collection Date', 'Expiry Date', 'Volume (ml)', 'Fridge Compartment', 'Status'],
    ...snapshot.fridgeBags.map((b) => [
      b.serialNumber,
      b.bloodGroup,
      b.collectionDate,
      b.expiryDate,
      b.volumeMl,
      b.compartment,
      b.status,
    ]),
    [],
    ['=== 2. EMERGENCY BLOOD REQUISITIONS ==='],
    ['Patient Name', 'Blood Group', 'Units', 'Hospital & Ward', 'Urgency', 'Contact Phone', 'Approval/Fulfillment Status', 'Logged Date'],
    ...snapshot.requisitions.map((r) => [
      r.patient,
      r.bloodGroup,
      r.units,
      r.hospital,
      r.urgency,
      r.phone,
      r.status,
      r.createdAt,
    ]),
    [],
    ['=== 3. VACCINE STOCK & PRICING CATALOG ==='],
    ['Vaccine Name', 'Price per Dose (BDT)', 'Total Doses', 'Doses in Stock', 'Clinical Schedule'],
    ...snapshot.vaccines.map((v) => [
      v.name,
      v.priceBdt,
      v.totalDoses,
      v.stockCount,
      v.scheduleText,
    ]),
    [],
    ['=== 4. SANDHANI EXECUTIVE & VOLUNTEER MEMBERS ==='],
    ['Member Name', 'Designation / Post', 'Phone Number', 'Blood Group', 'RMC Batch / Session'],
    ...snapshot.members.map((m) => [
      m.name,
      m.designation,
      m.phone,
      m.bloodGroup,
      m.batch,
    ]),
    [],
    ['=== 5. MASTER VOLUNTARY BLOOD DONOR DIRECTORY ==='],
    ['Donor Name', 'Blood Group', 'Phone Number', 'Email', 'Medical College Unit', 'Last Donation Date', 'Emergency Available'],
    ...snapshot.donors.map((d) => [
      d.name,
      d.bloodGroup,
      d.phone,
      d.email,
      d.unit,
      d.lastDonationDate || 'Never',
      d.isAvailable ? 'Yes' : 'No',
    ]),
  ];
  return rows;
}

/**
 * Creates a brand-new Google Sheet in the user's account and writes the complete Sandhani backup.
 */
export async function createAndSyncBackupSpreadsheet(
  accessToken: string,
  snapshot: BackupPayloadSnapshot
): Promise<{ spreadsheetId: string; spreadsheetUrl: string; title: string }> {
  const dateLabel = new Date().toISOString().split('T')[0];
  const title = `Sandhani RMC Unit Backup — ${dateLabel}`;

  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { title },
      sheets: [
        {
          properties: {
            title: 'Sandhani_Master_Backup',
            gridProperties: { frozenRowCount: 1 },
          },
        },
      ],
    }),
  });

  if (!createRes.ok) {
    const errData = await createRes.json().catch(() => ({}));
    throw new Error(
      errData?.error?.message || `Failed to create Google Sheet (HTTP ${createRes.status})`
    );
  }

  const created = await createRes.json();
  const spreadsheetId: string = created.spreadsheetId;
  const spreadsheetUrl: string =
    created.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  const firstSheetTitle: string =
    created.sheets?.[0]?.properties?.title || 'Sandhani_Master_Backup';

  const values = buildCombinedSheetRows(snapshot);

  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
      `${firstSheetTitle}!A1`
    )}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: `${firstSheetTitle}!A1`,
        majorDimension: 'ROWS',
        values,
      }),
    }
  );

  if (!updateRes.ok) {
    const errData = await updateRes.json().catch(() => ({}));
    throw new Error(
      errData?.error?.message || `Created sheet but failed to write rows (HTTP ${updateRes.status})`
    );
  }

  return { spreadsheetId, spreadsheetUrl, title };
}

/**
 * Syncs the Sandhani database snapshot into an existing Google Sheet after fetching its first sheet tab title.
 */
export async function syncToExistingSpreadsheet(
  accessToken: string,
  spreadsheetInput: string,
  snapshot: BackupPayloadSnapshot
): Promise<{ spreadsheetId: string; spreadsheetUrl: string; sheetTitle: string; rowsWritten: number }> {
  const spreadsheetId = extractSpreadsheetId(spreadsheetInput);

  // Per references/sheets.md: fetch spreadsheet metadata first to identify actual tab name
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!metaRes.ok) {
    const errData = await metaRes.json().catch(() => ({}));
    throw new Error(
      errData?.error?.message ||
        `Could not read Google Sheet metadata. Verify the Spreadsheet ID and permissions.`
    );
  }

  const meta = await metaRes.json();
  const firstSheetTitle: string = meta.sheets?.[0]?.properties?.title || 'Sheet1';
  const spreadsheetUrl: string =
    meta.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  const values = buildCombinedSheetRows(snapshot);

  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
      `${firstSheetTitle}!A1`
    )}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: `${firstSheetTitle}!A1`,
        majorDimension: 'ROWS',
        values,
      }),
    }
  );

  if (!updateRes.ok) {
    const errData = await updateRes.json().catch(() => ({}));
    throw new Error(
      errData?.error?.message || `Failed to update Google Sheet (HTTP ${updateRes.status})`
    );
  }

  return {
    spreadsheetId,
    spreadsheetUrl,
    sheetTitle: firstSheetTitle,
    rowsWritten: values.length,
  };
}
