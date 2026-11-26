import type { Readable } from 'stream';
import type { proto } from '../../WAProto/index.js';

export type ChatWallpaperKey =
    | 'defaultWallpaper'
    | 'solidColor'
    | 'stockImage'
    | 'customImage'
    | 'animatedWallpaper';

export type ArgbColorInput = number | string;

export type ChatWallpaperMediaInput =
    | Buffer
    | Uint8Array
    | { url: string | URL }
    | { stream: Readable };

export interface ChatDefaultWallpaperInput {
    type?: 'default' | 'defaultWallpaper';
    isDoodleEnabled?: boolean;
}

export interface ChatSolidColorWallpaperInput {
    type?: 'solid' | 'solidColor';
    backgroundLight?: ArgbColorInput;
    backgroundDark?: ArgbColorInput;
    backgroundLightArgb?: ArgbColorInput;
    backgroundDarkArgb?: ArgbColorInput;
    doodleLight?: ArgbColorInput;
    doodleDark?: ArgbColorInput;
    doodleLightArgb?: ArgbColorInput;
    doodleDarkArgb?: ArgbColorInput;
    colorLight?: string;
    colorDark?: string;
    isDoodleEnabled?: boolean;
}

export interface ChatStockImageWallpaperInput {
    type?: 'stock' | 'stockImage';
    stockImageId: string;
    dimLevel?: number;
}

export interface ChatCustomImageWallpaperInput {
    type?: 'custom' | 'customImage';
    directPath: string;
    mediaKey: Uint8Array | Buffer | string;
    fileEncSha256: Uint8Array | Buffer | string;
    fileSha256: Uint8Array | Buffer | string;
    dimLevel?: number;
}

export interface ChatCustomImageUploadInput {
    type?: 'custom' | 'customImage';
    image?: ChatWallpaperMediaInput;
    media?: ChatWallpaperMediaInput;
    dimLevel?: number;
}

export interface ChatAnimatedWallpaperInput {
    type?: 'animated' | 'animatedWallpaper';
    animatedWallpaperId: string;
    dimLevel?: number;
}

export type ChatWallpaperInput =
    | 'default'
    | ChatDefaultWallpaperInput
    | ChatSolidColorWallpaperInput
    | ChatStockImageWallpaperInput
    | ChatCustomImageWallpaperInput
    | ChatAnimatedWallpaperInput
    | { defaultWallpaper: proto.Message.IChatDefaultWallpaper }
    | { solidColor: ChatSolidColorWallpaperInput }
    | { stockImage: proto.Message.IChatStockImageWallpaper }
    | { customImage: ChatCustomImageWallpaperInput }
    | { animatedWallpaper: proto.Message.IChatAnimatedWallpaper };

export type ChatWallpaperUploadableInput =
    | ChatWallpaperInput
    | ChatWallpaperMediaInput
    | ChatCustomImageUploadInput;

export interface ChatThemeSettingInput {
    settingTimestampMs?: number;
    clearTheme?: boolean;
    colorSchemeId?: string;
    wallpaper?: ChatWallpaperInput;
    defaultWallpaper?: proto.Message.IChatDefaultWallpaper;
    solidColor?: ChatSolidColorWallpaperInput;
    stockImage?: proto.Message.IChatStockImageWallpaper;
    customImage?: ChatCustomImageWallpaperInput;
    animatedWallpaper?: proto.Message.IChatAnimatedWallpaper;
}

export interface ChatThemeSendInput extends Omit<ChatThemeSettingInput, 'wallpaper' | 'customImage'> {
    wallpaper?: ChatWallpaperUploadableInput;
    customImage?: ChatCustomImageWallpaperInput | ChatCustomImageUploadInput | ChatWallpaperMediaInput;
    image?: ChatWallpaperMediaInput;
    dimLevel?: number;
}

export interface ChatThemeSendOptions {
    messageId?: string;
    additionalAttributes?: Record<string, string>;
    additionalNodes?: any[];
    useUserDevicesCache?: boolean;
    useCachedGroupMetadata?: boolean;
    mediaUploadTimeoutMs?: number;
    dimLevel?: number;
    settingTimestampMs?: number;
    colorSchemeId?: string;
}

export interface ChatThemeSendResult {
    jid: string;
    messageId: string;
    chatThemeSetting: proto.Message.IChatThemeSetting;
}

export interface ExtractedChatThemeSetting {
    settingTimestampMs?: number;
    clearTheme: boolean;
    colorSchemeId?: string;
    wallpaperType: ChatWallpaperKey | null;
    wallpaper:
        | proto.Message.IChatDefaultWallpaper
        | proto.Message.IChatSolidColorWallpaper
        | proto.Message.IChatStockImageWallpaper
        | proto.Message.IChatCustomImageWallpaper
        | proto.Message.IChatAnimatedWallpaper
        | null;
    raw: proto.Message.IChatThemeSetting;
}

export interface ChatThemeUpdateEvent {
    jid: string;
    participant?: string | null;
    participantAlt?: string | null;
    fromMe: boolean;
    messageTimestamp: number;
    setting: ExtractedChatThemeSetting;
}

export interface ChatThemeSocketHelpers {
    setChatTheme: (jid: string, theme: ChatThemeSendInput, options?: ChatThemeSendOptions) => Promise<ChatThemeSendResult>;
    setGroupTheme: (jid: string, theme: ChatThemeSendInput, options?: ChatThemeSendOptions) => Promise<ChatThemeSendResult>;
    clearChatTheme: (jid: string, options?: ChatThemeSendOptions) => Promise<ChatThemeSendResult>;
    clearGroupTheme: (jid: string, options?: ChatThemeSendOptions) => Promise<ChatThemeSendResult>;
    setChatWallpaper: (jid: string, wallpaper: ChatWallpaperUploadableInput, options?: ChatThemeSendOptions) => Promise<ChatThemeSendResult>;
    setGroupWallpaper: (jid: string, wallpaper: ChatWallpaperUploadableInput, options?: ChatThemeSendOptions) => Promise<ChatThemeSendResult>;
    downloadChatWallpaper: (input: any, options?: { host?: string; asStream?: boolean; options?: any }) => Promise<Buffer | Readable>;
}

export declare const CHAT_WALLPAPER_KEYS: ReadonlyArray<ChatWallpaperKey>;
export declare function parseArgbColor(value: ArgbColorInput): number;
export declare function formatArgbColor(argb: ArgbColorInput, includeAlpha?: boolean): string;
export declare function isMediaUploadInput(value: unknown): value is ChatWallpaperMediaInput;
export declare function buildChatWallpaper(input: ChatWallpaperInput): {
    key: ChatWallpaperKey;
    value: any;
};
export declare function buildChatThemeSetting(input: ChatThemeSettingInput): proto.Message.IChatThemeSetting;
export declare function buildChatThemeProtocolMessage(input: ChatThemeSettingInput): {
    chatThemeSetting: proto.Message.IChatThemeSetting;
    content: {
        protocolMessage: proto.Message.IProtocolMessage;
    };
};
export declare function buildWallpaperSettings(input?: proto.IWallpaperSettings): proto.IWallpaperSettings;
export declare function buildSettingsSyncWallpaperAction(input?: Pick<
    proto.SyncActionValue.ISettingsSyncAction,
    'appTheme' | 'wallpaperId' | 'isDoodleWallpaperEnabled' | 'chatThemeId' | 'colorSchemeId' | 'stockWallpaperImageId'
>): proto.SyncActionValue.ISettingsSyncAction;
export declare function extractChatThemeSetting(input: any): ExtractedChatThemeSetting | null;
export declare function uploadChatWallpaperImage(
    media: ChatWallpaperMediaInput,
    upload: (filePath: string, opts: { fileEncSha256B64: string; mediaType: string; timeoutMs?: number }) => Promise<{ directPath?: string }>,
    options?: { logger?: any; options?: any; mediaUploadTimeoutMs?: number; dimLevel?: number }
): Promise<proto.Message.IChatCustomImageWallpaper>;
export declare function downloadChatWallpaperImage(
    input: any,
    options?: { host?: string; asStream?: boolean; options?: any }
): Promise<Buffer | Readable>;
export declare function makeChatThemeHelpers(sock: any, config?: any): ChatThemeSocketHelpers;
