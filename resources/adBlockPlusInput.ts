export type AdBlockPlus = {
    type: "ads" | "privacy" | "circumvention" | "social" | "notifications" | "cookies"
    languages?: string[]
    title: string
    url: string
    homepage: string
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
export const AdBlockPlusInput: AdBlockPlus[] = require("adblockpluscore/data/subscriptions.json").filter((input: AdBlockPlus) => (input.type !== "cookies" && input.type !== "circumvention"));
