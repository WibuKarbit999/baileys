import { Boom } from '@hapi/boom';
import { promises as fs } from 'fs';
import { proto } from '../../WAProto/index.js';
import { isJidGroup } from '../WABinary/index.js';
import { normalizeMessageContent } from './messages.js';
import { downloadContentFromMessage, encryptedStream, toBuffer } from './messages-media.js';

export const CHAT_WALLPAPER_MEDIA_TYPE = 'chat-wallpaper-image';

export const CHAT_WALLPAPER_KEYS = Object.freeze([
    'defaultWallpaper',
    'solidColor',
    'stockImage',
    'customImage',
    'animatedWallpaper'
]);

export const CHAT_THEME_COLORS = Object.freeze({
    Default: 'Default',
    WhatsAppGreen: 'WhatsApp-Green',
    PearlIndigo: 'Pearl-Indigo',
    TyrianPurple: 'Tyrian-Purple',
    SunsetOrange: 'Sunset-Orange',
    MerinoTeal: 'Merino-Teal',
    RoyalBlue: 'Royal-Blue',
    DarkCerulean: 'Dark-Cerulean',
    CharcoalGreen: 'Charcoal-Green',
    PersianPlum: 'Persian-Plum',
    DuneMono: 'Dune-Mono',
    DefaultBlue: 'Default-Blue',
    DefaultMono: 'Default-Mono',
    SkyBlue: 'Sky-Blue',
    Brown: 'Brown',
    Cream: 'Cream',
    Emerald: 'Emerald',
    Lemon: 'Lemon',
    Lime: 'Lime',
    Pink: 'Pink',
    Red: 'Red',
    SunriseOrange: 'Sunrise-Orange',
    WarmYellow: 'Warm-Yellow'
});

export const CHAT_TONAL_SCHEMES = Object.freeze({
    WhatsAppGreen: 'WhatsApp-Green@Tonal',
    PearlIndigo: 'Pearl-Indigo@Tonal',
    TyrianPurple: 'Tyrian-Purple@Tonal',
    SunsetOrange: 'Sunset-Orange@Tonal',
    MerinoTeal: 'Merino-Teal@Tonal',
    RoyalBlue: 'Royal-Blue@Tonal',
    DarkCerulean: 'Dark-Cerulean@Tonal',
    CharcoalGreen: 'Charcoal-Green@Tonal',
    PersianPlum: 'Persian-Plum@Tonal',
    DuneMono: 'Dune-Mono@Tonal',
    DefaultBlue: 'Default-Blue@Tonal',
    DefaultMono: 'Default-Mono@Tonal',
    SkyBlue: 'Sky-Blue@Tonal',
    Brown: 'Brown@Tonal',
    Cream: 'Cream@Tonal',
    Emerald: 'Emerald@Tonal',
    Lemon: 'Lemon@Tonal',
    Lime: 'Lime@Tonal',
    Pink: 'Pink@Tonal',
    Red: 'Red@Tonal',
    SunriseOrange: 'Sunrise-Orange@Tonal',
    WarmYellow: 'Warm-Yellow@Tonal'
});

export const CHAT_MINIMAL_SCHEMES = Object.freeze({
    DefaultBlue: 'Default-Blue@Minimal',
    DefaultMono: 'Default-Mono@Minimal',
    SkyBlue: 'Sky-Blue@Minimal',
    PearlIndigo: 'Pearl-Indigo@Minimal'
});

export const SOLID_WALLPAPER_PALETTE = Object.freeze([
    Object.freeze({ name: 'Soft teal', light: '#C7E9EB', dark: '#2E7B80' }),
    Object.freeze({ name: 'Soft mint', light: '#CCEBDC', dark: '#587D6B' }),
    Object.freeze({ name: 'Sage', light: '#AED8C7', dark: '#39765D' }),
    Object.freeze({ name: 'Pale teal', light: '#A9DBD8', dark: '#30726E' }),
    Object.freeze({ name: 'Sky cyan', light: '#68D5D9', dark: '#0F6E72' }),
    Object.freeze({ name: 'Muted cyan', light: '#6EC3D4', dark: '#297A8B' }),
    Object.freeze({ name: 'Emerald', light: '#7ACBA5', dark: '#2E7553' }),
    Object.freeze({ name: 'Soft green', light: '#73C780', dark: '#327C3D' }),
    Object.freeze({ name: 'Olive', light: '#D0DEB1', dark: '#657C34' }),
    Object.freeze({ name: 'Pale olive', light: '#DEE0B4', dark: '#767932' }),
    Object.freeze({ name: 'Warm tan', light: '#E6DFA8', dark: '#686543' }),
    Object.freeze({ name: 'Pale yellow', light: '#F7E9A8', dark: '#846F0C' }),
    Object.freeze({ name: 'Yellow green', light: '#E6E365', dark: '#817E00' }),
    Object.freeze({ name: 'Peach', light: '#FFD1A4', dark: '#A54733' }),
    Object.freeze({ name: 'Blush', light: '#F2DAD5', dark: '#933F2E' }),
    Object.freeze({ name: 'Rose blush', light: '#F2D5E1', dark: '#9D315E' }),
    Object.freeze({ name: 'Lavender', light: '#D7D3EB', dark: '#5F4FAF' }),
    Object.freeze({ name: 'Periwinkle', light: '#CBDAEC', dark: '#3F70AC' }),
    Object.freeze({ name: 'Orchid', light: '#E5C0EB', dark: '#8F329E' }),
    Object.freeze({ name: 'Baby pink', light: '#FBCAD2', dark: '#6E2A38' }),
    Object.freeze({ name: 'Coral', light: '#FFA7A8', dark: '#63202B' }),
    Object.freeze({ name: 'Salmon', light: '#FF8A8C', dark: '#4D0808' }),
    Object.freeze({ name: 'Warm red', light: '#F56056', dark: '#5A1916' }),
    Object.freeze({ name: 'Rose red', light: '#FF5978', dark: '#570F1D' }),
    Object.freeze({ name: 'Terracotta', light: '#DC6E4F', dark: '#571800' }),
    Object.freeze({ name: 'Dark plum', light: '#48324D', dark: '#36263A' }),
    Object.freeze({ name: 'Gray brown', light: '#74676A', dark: '#2A2627' }),
    Object.freeze({ name: 'Steel blue', light: '#7E90A3', dark: '#2C3136' }),
    Object.freeze({ name: 'Indigo', light: '#7A77D9', dark: '#2C2A63' }),
    Object.freeze({ name: 'Royal blue', light: '#2B5AA6', dark: '#122747' }),
    Object.freeze({ name: 'Sky blue', light: '#219ED9', dark: '#00405E' }),
    Object.freeze({ name: 'Deep teal', light: '#2293A4', dark: '#003C40' }),
    Object.freeze({ name: 'Blue gray', light: '#55626F', dark: '#1E262F' }),
    Object.freeze({ name: 'Light gray', light: '#C0C1C4', dark: '#4E4B4B' }),
    Object.freeze({ name: 'Silver', light: '#D9DADE', dark: '#6D6D6E' }),
    Object.freeze({ name: 'Charcoal', light: '#243640', dark: '#1B262D' }),
    Object.freeze({ name: 'Default', light: '#F5F1EB', dark: '#0A0A0A' })
]);

const normalizePresetKey = (name) => String(name || '').trim().toLowerCase().replace(/[-_\s]+/g, ' ');
const SOLID_PALETTE_INDEX = new Map(SOLID_WALLPAPER_PALETTE.map(entry => [normalizePresetKey(entry.name), entry]));

export const findSolidWallpaperPreset = (name) => {
    if (typeof name !== 'string' || !name.trim()) {
        return null;
    }
    return SOLID_PALETTE_INDEX.get(normalizePresetKey(name)) ?? null;
};

const assertFiniteNumber = (value, label) => {
    const num = Number(value);
    if (!Number.isFinite(num)) {
        throw new TypeError(`${label} must be a finite number`);
    }
    return num;
};

const toBytes = (value, label) => {
    if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
        return value;
    }
    if (typeof value === 'string' && value.length > 0) {
        return Buffer.from(value, 'base64');
    }
    throw new TypeError(`${label} must be a Uint8Array, Buffer, or base64 string`);
};

const normalizeTimestampMs = (value) => {
    if (value === undefined || value === null) {
        return Date.now();
    }
    if (typeof value === 'object' && typeof value.toNumber === 'function') {
        return value.toNumber();
    }
    return Math.trunc(assertFiniteNumber(value, 'settingTimestampMs'));
};

export const parseArgbColor = (value) => {
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            throw new TypeError('ARGB color number must be finite');
        }
        return value >>> 0;
    }
    if (typeof value === 'string') {
        const cleaned = value.trim().replace(/^#/, '');
        if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
            return (0xff000000 | parseInt(cleaned, 16)) >>> 0;
        }
        if (/^[0-9a-fA-F]{8}$/.test(cleaned)) {
            return parseInt(cleaned, 16) >>> 0;
        }
    }
    throw new TypeError(`Invalid ARGB/hex color: ${JSON.stringify(value)}. Expected #RRGGBB, #AARRGGBB, or uint32 number`);
};

export const formatArgbColor = (argb, includeAlpha = true) => {
    const num = parseArgbColor(argb);
    if (includeAlpha) {
        return '#' + num.toString(16).padStart(8, '0').toUpperCase();
    }
    return '#' + (num & 0x00ffffff).toString(16).padStart(6, '0').toUpperCase();
};

export const isMediaUploadInput = (value) => {
    if (!value) {
        return false;
    }
    if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
        return true;
    }
    if (typeof value === 'object') {
        return 'url' in value || 'stream' in value;
    }
    return false;
};

const buildSolidColorWallpaper = (raw) => {
    const out = {};
    let presetEntry = null;
    if (raw.preset !== undefined && raw.preset !== null) {
        presetEntry = findSolidWallpaperPreset(raw.preset);
        if (!presetEntry) {
            throw new TypeError(`Unknown solid wallpaper preset: ${JSON.stringify(raw.preset)}`);
        }
    }

    const singleColor = raw.color !== undefined && raw.color !== null ? parseArgbColor(raw.color) : undefined;
    let lightArgb = raw.backgroundLightArgb !== undefined && raw.backgroundLightArgb !== null
        ? parseArgbColor(raw.backgroundLightArgb)
        : raw.backgroundLight !== undefined && raw.backgroundLight !== null
            ? parseArgbColor(raw.backgroundLight)
            : singleColor ?? (presetEntry ? parseArgbColor(presetEntry.light) : undefined);

    let darkArgb = raw.backgroundDarkArgb !== undefined && raw.backgroundDarkArgb !== null
        ? parseArgbColor(raw.backgroundDarkArgb)
        : raw.backgroundDark !== undefined && raw.backgroundDark !== null
            ? parseArgbColor(raw.backgroundDark)
            : singleColor ?? (presetEntry ? parseArgbColor(presetEntry.dark) : undefined);

    if (lightArgb !== undefined && darkArgb === undefined && raw.colorDark === undefined) {
        darkArgb = lightArgb;
    }
    else if (darkArgb !== undefined && lightArgb === undefined && raw.colorLight === undefined) {
        lightArgb = darkArgb;
    }

    if (lightArgb !== undefined) {
        out.backgroundLightArgb = lightArgb;
    }
    else if (raw.colorLight !== undefined && raw.colorLight !== null) {
        out.colorLight = String(raw.colorLight);
    }

    if (darkArgb !== undefined) {
        out.backgroundDarkArgb = darkArgb;
    }
    else if (raw.colorDark !== undefined && raw.colorDark !== null) {
        out.colorDark = String(raw.colorDark);
    }

    const doodleLight = raw.doodleLightArgb ?? raw.doodleLight;
    if (doodleLight !== undefined && doodleLight !== null) {
        out.doodleLightArgb = parseArgbColor(doodleLight);
    }

    const doodleDark = raw.doodleDarkArgb ?? raw.doodleDark;
    if (doodleDark !== undefined && doodleDark !== null) {
        out.doodleDarkArgb = parseArgbColor(doodleDark);
    }

    if (typeof raw.isDoodleEnabled === 'boolean') {
        out.isDoodleEnabled = raw.isDoodleEnabled;
    }
    else if (lightArgb !== undefined || darkArgb !== undefined) {
        out.isDoodleEnabled = true;
    }

    if (Object.keys(out).length === 0) {
        throw new TypeError('solidColor wallpaper requires at least one color, preset, or doodle property');
    }
    return out;
};

export const buildChatWallpaper = (input) => {
    if (input === 'default') {
        return { key: 'defaultWallpaper', value: {} };
    }
    if (typeof input === 'string') {
        const preset = findSolidWallpaperPreset(input);
        if (preset) {
            return { key: 'solidColor', value: buildSolidColorWallpaper({ preset: preset.name }) };
        }
        if (/^#?[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(input.trim())) {
            return { key: 'solidColor', value: buildSolidColorWallpaper({ color: input }) };
        }
        throw new TypeError(`Unsupported wallpaper string: ${JSON.stringify(input)}`);
    }
    if (!input || typeof input !== 'object') {
        throw new TypeError('wallpaper input must be "default", a color/preset string, or an object');
    }

    const type = input.type;
    if (type === 'default' || type === 'defaultWallpaper' || 'defaultWallpaper' in input) {
        const src = 'defaultWallpaper' in input ? (input.defaultWallpaper || {}) : input;
        const value = {};
        if (typeof src.isDoodleEnabled === 'boolean') {
            value.isDoodleEnabled = src.isDoodleEnabled;
        }
        return { key: 'defaultWallpaper', value };
    }

    if (type === 'solid' || type === 'solidColor' || 'solidColor' in input || 'preset' in input || 'color' in input || 'backgroundLight' in input || 'backgroundDark' in input || 'backgroundLightArgb' in input || 'backgroundDarkArgb' in input) {
        const src = 'solidColor' in input ? input.solidColor : input;
        return { key: 'solidColor', value: buildSolidColorWallpaper(src || {}) };
    }

    if (type === 'stock' || type === 'stockImage' || 'stockImage' in input || 'stockImageId' in input) {
        const src = 'stockImage' in input ? input.stockImage : input;
        if (!src?.stockImageId || typeof src.stockImageId !== 'string') {
            throw new TypeError('stockImage wallpaper requires a non-empty stockImageId string');
        }
        const value = { stockImageId: src.stockImageId };
        if (src.dimLevel !== undefined && src.dimLevel !== null) {
            value.dimLevel = assertFiniteNumber(src.dimLevel, 'dimLevel');
        }
        return { key: 'stockImage', value };
    }

    if (type === 'custom' || type === 'customImage' || 'customImage' in input || 'directPath' in input) {
        const src = 'customImage' in input ? input.customImage : input;
        if (!src?.directPath || typeof src.directPath !== 'string') {
            throw new TypeError('customImage wallpaper requires directPath');
        }
        const value = {
            directPath: src.directPath,
            mediaKey: toBytes(src.mediaKey, 'customImage.mediaKey'),
            fileEncSha256: toBytes(src.fileEncSha256, 'customImage.fileEncSha256'),
            fileSha256: toBytes(src.fileSha256, 'customImage.fileSha256'),
            dimLevel: src.dimLevel !== undefined && src.dimLevel !== null
                ? assertFiniteNumber(src.dimLevel, 'dimLevel')
                : 0
        };
        return { key: 'customImage', value };
    }

    if (type === 'animated' || type === 'animatedWallpaper' || 'animatedWallpaper' in input || 'animatedWallpaperId' in input) {
        const src = 'animatedWallpaper' in input ? input.animatedWallpaper : input;
        if (!src?.animatedWallpaperId || typeof src.animatedWallpaperId !== 'string') {
            throw new TypeError('animatedWallpaper requires a non-empty animatedWallpaperId string');
        }
        const value = { animatedWallpaperId: src.animatedWallpaperId };
        if (src.dimLevel !== undefined && src.dimLevel !== null) {
            value.dimLevel = assertFiniteNumber(src.dimLevel, 'dimLevel');
        }
        return { key: 'animatedWallpaper', value };
    }

    throw new TypeError('Unsupported wallpaper specification');
};

export const buildChatThemeSetting = (input) => {
    if (!input || typeof input !== 'object') {
        throw new TypeError('chatThemeSetting input must be an object');
    }

    const settingTimestampMs = normalizeTimestampMs(input.settingTimestampMs);
    const clearTheme = Boolean(input.clearTheme);
    const rawColorSchemeId = input.colorSchemeId ?? input.chatThemeId;

    const directWallpaperKeys = CHAT_WALLPAPER_KEYS.filter(key => input[key] !== undefined && input[key] !== null);
    if (directWallpaperKeys.length > 1) {
        throw new TypeError(`Only one wallpaper variant may be set at a time (got: ${directWallpaperKeys.join(', ')})`);
    }
    if (directWallpaperKeys.length === 1 && input.wallpaper !== undefined && input.wallpaper !== null) {
        throw new TypeError(`Cannot combine wallpaper shorthand with ${directWallpaperKeys[0]}`);
    }

    if (clearTheme) {
        if (rawColorSchemeId || directWallpaperKeys.length > 0 || input.wallpaper !== undefined) {
            throw new TypeError('clearTheme cannot be combined with colorSchemeId or wallpaper fields');
        }
        return {
            settingTimestampMs,
            clearTheme: true
        };
    }

    const setting = { settingTimestampMs };
    if (rawColorSchemeId !== undefined && rawColorSchemeId !== null) {
        if (typeof rawColorSchemeId !== 'string' || rawColorSchemeId.length === 0) {
            throw new TypeError('colorSchemeId must be a non-empty string');
        }
        setting.colorSchemeId = rawColorSchemeId;
    }

    if (input.wallpaper !== undefined && input.wallpaper !== null) {
        const { key, value } = buildChatWallpaper(input.wallpaper);
        setting[key] = value;
    }
    else if (directWallpaperKeys.length === 1) {
        const key = directWallpaperKeys[0];
        const { value } = buildChatWallpaper({ [key]: input[key] });
        setting[key] = value;
    }

    const hasWallpaper = CHAT_WALLPAPER_KEYS.some(key => setting[key] !== undefined);
    if (!setting.colorSchemeId && !hasWallpaper) {
        throw new TypeError('ChatThemeSetting requires clearTheme, colorSchemeId, or a wallpaper');
    }

    return setting;
};

export const buildChatThemeProtocolMessage = (input) => {
    const chatThemeSetting = buildChatThemeSetting(input);
    return {
        chatThemeSetting,
        content: {
            protocolMessage: {
                type: proto.Message.ProtocolMessage.Type.CHAT_THEME_SETTING,
                chatThemeSetting
            }
        }
    };
};

export const buildWallpaperSettings = (input = {}) => {
    const out = {};
    if (input.filename !== undefined && input.filename !== null) {
        out.filename = String(input.filename);
    }
    if (input.opacity !== undefined && input.opacity !== null) {
        out.opacity = Math.max(0, Math.trunc(assertFiniteNumber(input.opacity, 'opacity')));
    }
    if (typeof input.isGenAi === 'boolean') {
        out.isGenAi = input.isGenAi;
    }
    return out;
};

export const buildSettingsSyncWallpaperAction = (input = {}) => {
    const out = {};
    if (input.appTheme !== undefined && input.appTheme !== null) {
        out.appTheme = Math.trunc(assertFiniteNumber(input.appTheme, 'appTheme'));
    }
    if (input.wallpaperId !== undefined && input.wallpaperId !== null) {
        out.wallpaperId = Math.trunc(assertFiniteNumber(input.wallpaperId, 'wallpaperId'));
    }
    if (typeof input.isDoodleWallpaperEnabled === 'boolean') {
        out.isDoodleWallpaperEnabled = input.isDoodleWallpaperEnabled;
    }
    if (input.chatThemeId !== undefined && input.chatThemeId !== null) {
        out.chatThemeId = String(input.chatThemeId);
    }
    if (input.colorSchemeId !== undefined && input.colorSchemeId !== null) {
        out.colorSchemeId = String(input.colorSchemeId);
    }
    if (input.stockWallpaperImageId !== undefined && input.stockWallpaperImageId !== null) {
        out.stockWallpaperImageId = String(input.stockWallpaperImageId);
    }
    return out;
};

const unwrapChatThemeSetting = (input) => {
    if (!input || typeof input !== 'object') {
        return null;
    }
    if ('message' in input && input.message) {
        const normalized = normalizeMessageContent(input.message);
        if (normalized?.protocolMessage?.chatThemeSetting) {
            return normalized.protocolMessage.chatThemeSetting;
        }
    }
    const normalized = normalizeMessageContent(input);
    if (normalized?.protocolMessage?.chatThemeSetting) {
        return normalized.protocolMessage.chatThemeSetting;
    }
    if ('chatThemeSetting' in input && input.chatThemeSetting) {
        return input.chatThemeSetting;
    }
    if ('settingTimestampMs' in input || 'clearTheme' in input || 'colorSchemeId' in input || CHAT_WALLPAPER_KEYS.some(k => k in input)) {
        return input;
    }
    return null;
};

export const extractChatThemeSetting = (input) => {
    const raw = unwrapChatThemeSetting(input);
    if (!raw) {
        return null;
    }
    const wallpaperType = CHAT_WALLPAPER_KEYS.find(key => raw[key] !== undefined && raw[key] !== null) || null;
    const settingTimestampMs = raw.settingTimestampMs !== undefined && raw.settingTimestampMs !== null
        ? normalizeTimestampMs(raw.settingTimestampMs)
        : undefined;

    return {
        settingTimestampMs,
        clearTheme: Boolean(raw.clearTheme),
        colorSchemeId: raw.colorSchemeId ?? undefined,
        wallpaperType,
        wallpaper: wallpaperType ? raw[wallpaperType] : null,
        raw
    };
};

export const uploadChatWallpaperImage = async (media, upload, options = {}) => {
    if (!isMediaUploadInput(media)) {
        throw new TypeError('media must be a Buffer, Uint8Array, { url }, or { stream }');
    }
    if (typeof upload !== 'function') {
        throw new TypeError('upload function (waUploadToServer) is required');
    }

    const mediaType = options.mediaType ?? CHAT_WALLPAPER_MEDIA_TYPE;
    const { encFilePath, mediaKey, fileEncSha256, fileSha256 } = await encryptedStream(media, mediaType, {
        logger: options.logger,
        opts: options.options
    });

    try {
        let uploadResult;
        try {
            uploadResult = await upload(encFilePath, {
                fileEncSha256B64: fileEncSha256.toString('base64'),
                mediaType,
                timeoutMs: options.mediaUploadTimeoutMs
            });
        }
        catch (err) {
            if (mediaType !== CHAT_WALLPAPER_MEDIA_TYPE) {
                throw err;
            }
            options.logger?.debug?.({ err }, 'chat-wallpaper-image upload failed, retrying on /mms/image');
            uploadResult = await upload(encFilePath, {
                fileEncSha256B64: fileEncSha256.toString('base64'),
                mediaType: 'image',
                timeoutMs: options.mediaUploadTimeoutMs
            });
        }
        if (!uploadResult?.directPath) {
            throw new Boom('Wallpaper image upload did not return a directPath', { statusCode: 500, data: uploadResult });
        }
        return {
            directPath: uploadResult.directPath,
            mediaKey,
            fileEncSha256,
            fileSha256,
            dimLevel: options.dimLevel !== undefined && options.dimLevel !== null
                ? assertFiniteNumber(options.dimLevel, 'dimLevel')
                : 0
        };
    }
    finally {
        await fs.unlink(encFilePath).catch(() => {});
    }
};

const extractCustomImageWallpaper = (input) => {
    if (!input || typeof input !== 'object') {
        return null;
    }
    if (input.directPath && input.mediaKey) {
        return input;
    }
    const extracted = extractChatThemeSetting(input);
    if (extracted?.wallpaperType === 'customImage' && extracted.wallpaper) {
        return extracted.wallpaper;
    }
    return null;
};

export const downloadChatWallpaperImage = async (input, options = {}) => {
    const customImage = extractCustomImageWallpaper(input);
    if (!customImage?.directPath || !customImage?.mediaKey) {
        throw new Boom('Input does not contain a downloadable customImage wallpaper (directPath & mediaKey required)', { statusCode: 400 });
    }
    const mediaType = options.mediaType ?? CHAT_WALLPAPER_MEDIA_TYPE;
    const stream = await downloadContentFromMessage(customImage, mediaType, options);
    if (options.asStream) {
        return stream;
    }
    return toBuffer(stream);
};

const resolveCustomImageSpec = async (spec, upload, uploadOptions) => {
    if (isMediaUploadInput(spec)) {
        return uploadChatWallpaperImage(spec, upload, uploadOptions);
    }
    if (spec && typeof spec === 'object') {
        const media = spec.media ?? spec.image;
        if (media !== undefined) {
            return uploadChatWallpaperImage(media, upload, {
                ...uploadOptions,
                dimLevel: spec.dimLevel ?? uploadOptions.dimLevel
            });
        }
    }
    return spec;
};

const prepareThemeInput = async (theme, upload, uploadOptions) => {
    if (!theme || typeof theme !== 'object') {
        throw new TypeError('theme must be an object');
    }

    const next = { ...theme };
    if (next.image !== undefined && next.customImage === undefined && next.wallpaper === undefined) {
        next.customImage = await uploadChatWallpaperImage(next.image, upload, {
            ...uploadOptions,
            dimLevel: next.dimLevel ?? uploadOptions.dimLevel
        });
        delete next.image;
        delete next.dimLevel;
        return next;
    }

    if (next.customImage !== undefined && next.customImage !== null) {
        next.customImage = await resolveCustomImageSpec(next.customImage, upload, uploadOptions);
        return next;
    }

    if (next.wallpaper !== undefined && next.wallpaper !== null) {
        if (isMediaUploadInput(next.wallpaper)) {
            next.customImage = await uploadChatWallpaperImage(next.wallpaper, upload, uploadOptions);
            delete next.wallpaper;
        }
        else if (typeof next.wallpaper === 'object' && (next.wallpaper.type === 'custom' || next.wallpaper.type === 'customImage' || 'image' in next.wallpaper || 'media' in next.wallpaper)) {
            const media = next.wallpaper.media ?? next.wallpaper.image;
            if (media !== undefined) {
                next.customImage = await uploadChatWallpaperImage(media, upload, {
                    ...uploadOptions,
                    dimLevel: next.wallpaper.dimLevel ?? uploadOptions.dimLevel
                });
                delete next.wallpaper;
            }
        }
    }

    return next;
};

export const makeChatThemeHelpers = (sock, config = {}) => {
    const assertGroupJid = (jid, methodName) => {
        if (!isJidGroup(jid)) {
            throw new Boom(`${methodName} requires a group JID (@g.us)`, { statusCode: 400, data: { jid } });
        }
    };

    const setChatTheme = async (jid, theme, options = {}) => {
        if (!jid || typeof jid !== 'string') {
            throw new Boom('setChatTheme requires a target JID', { statusCode: 400 });
        }
        const prepared = await prepareThemeInput(theme, sock.waUploadToServer, {
            logger: config.logger ?? sock.logger,
            options: config.options,
            mediaUploadTimeoutMs: options.mediaUploadTimeoutMs,
            dimLevel: options.dimLevel
        });
        const { chatThemeSetting, content } = buildChatThemeProtocolMessage(prepared);
        const messageId = await sock.relayMessage(jid, content, options);
        return { jid, messageId, chatThemeSetting };
    };

    const setGroupTheme = async (jid, theme, options = {}) => {
        assertGroupJid(jid, 'setGroupTheme');
        return setChatTheme(jid, theme, options);
    };

    const clearChatTheme = async (jid, options = {}) => {
        return setChatTheme(jid, {
            clearTheme: true,
            settingTimestampMs: options.settingTimestampMs
        }, options);
    };

    const clearGroupTheme = async (jid, options = {}) => {
        assertGroupJid(jid, 'clearGroupTheme');
        return clearChatTheme(jid, options);
    };

    const setChatWallpaper = async (jid, wallpaper, options = {}) => {
        const theme = {
            wallpaper,
            ...(options.colorSchemeId ? { colorSchemeId: options.colorSchemeId } : {}),
            ...(options.settingTimestampMs !== undefined ? { settingTimestampMs: options.settingTimestampMs } : {})
        };
        return setChatTheme(jid, theme, options);
    };

    const setGroupWallpaper = async (jid, wallpaper, options = {}) => {
        assertGroupJid(jid, 'setGroupWallpaper');
        return setChatWallpaper(jid, wallpaper, options);
    };

    const downloadChatWallpaper = async (input, options = {}) => {
        const host = options.host ?? (typeof sock.getMediaHost === 'function' ? sock.getMediaHost() : undefined);
        return downloadChatWallpaperImage(input, {
            ...options,
            ...(host ? { host } : {}),
            options: options.options ?? config.options
        });
    };

    return {
        setChatTheme,
        setGroupTheme,
        clearChatTheme,
        clearGroupTheme,
        setChatWallpaper,
        setGroupWallpaper,
        downloadChatWallpaper
    };
};
