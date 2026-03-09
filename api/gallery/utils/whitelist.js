// api/utils/whitelist.js - Server-side ONLY, never exposed to client

// Your actual whitelist data (trimmed and normalized)
const WHITELIST_DATA = [
  { uuid: "d0af27ae-9d62-32f5-8524-f69a494e3c69", name: "Entropy_N" },
  { uuid: "36ccb137-35b5-33b2-8d2e-06c1b2d34ffc", name: "Ananta" },
  { uuid: "46f078a0-5693-3489-92f3-2fe6e4fbe256", name: "Ishann69" },
  { uuid: "468b4cbd-430c-38c9-a010-fc9d67e9eaee", name: "terabaap" },
  { uuid: "0b003561-83b3-3d15-a4f3-c82bf8fa4d31", name: "tsukuyomi_chan" },
  { uuid: "00000000-0000-0000-0009-01f314edc09d", name: ".infinityoq" },
  { uuid: "51cf15e6-3987-3f25-a715-3e9d552d357b", name: "blackhancy" },
  { uuid: "3471fb0c-9e74-36d6-8e37-a4d0d6ae7bac", name: "Awiddd" },
  { uuid: "8314e6cf-44fc-3237-9c4a-5202ac49afb5", name: "1unk1nown1" }
];

// Build lookup map: lowercase name → { uuid, name }
const whitelistMap = new Map(
  WHITELIST_DATA.map(entry => [entry.name.toLowerCase(), { 
    uuid: entry.uuid, 
    name: entry.name 
  }])
);

/**
 * Verify user against whitelist
 * @param {string} inputName - User-provided Minecraft username
 * @param {string} inputUuid - Optional UUID for extra verification
 * @returns {object} { valid, uuid?, whitelistName?, error? }
 */
export function verifyUser(inputName, inputUuid) {
  const name = (inputName || '').trim().toLowerCase();
  if (!name) return { valid: false, error: 'Username required' };
  
  const entry = whitelistMap.get(name);
  if (!entry) return { valid: false, error: 'Username not whitelisted' };
  
  // Optional strict UUID check (recommended)
  const uuid = (inputUuid || '').trim();
  if (uuid && uuid !== entry.uuid) {
    return { valid: false, error: 'UUID mismatch' };
  }
  
  return { valid: true, uuid: entry.uuid, whitelistName: entry.name };
}
