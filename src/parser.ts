import type { InputType } from "~resources/input";
import { getInput } from "~resources/input";
import * as path from "path";
import { writeFile } from "fs/promises";


export type Stats = Record<string, number>;

// Native fetch needs Node >= 26.5.0: older undici aborts the process on large `Connection: close`
// responses (https://github.com/nodejs/undici/issues/5360), which is what easylist.to serves.
// See docs/http-client.md.
const RETRY_LIMIT = 2;
const RETRY_DELAY_MS = 1000;
const RETRYABLE_STATUS_CODES: Set<number> = new Set([408, 413, 429, 500, 502, 503, 504, 521, 522, 524]);

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// `fetch` does not throw on non-2xx. Without this guard, an upstream 404 would yield an empty list.
export const fetchText = async (inputUrl: string): Promise<string> => {
    for (let attempt = 0; ; attempt++) {
        let error: Error;
        let isRetryable: boolean;
        try {
            const response: Response = await fetch(inputUrl);
            if (response.ok) {
                return await response.text();
            }
            error = new Error(`Failed to fetch ${inputUrl}: ${response.status} ${response.statusText}`);
            isRetryable = RETRYABLE_STATUS_CODES.has(response.status);
        }
        catch (fetchError) {
            error = fetchError as Error;
            isRetryable = true;
        }
        if (!isRetryable || attempt >= RETRY_LIMIT) {
            throw error;
        }
        await delay(RETRY_DELAY_MS * (attempt + 1));
    }
};

const isHebrewFile = (inputUrl: string): boolean => {
    return inputUrl.endsWith("EasyListHebrew.txt");
};

const getUniqueLinesSorted = (input: string | string[]): string[] => {
    const lines: string[] = (typeof input === "string") ? input.split("\n") : input.join("\n").split("\n");
    return Array.from(new Set(lines)).sort();
};

const fetchAllDomainsForSingleTarget = async (targetFile: string, inputUrls: string[], stats?: Stats): Promise<string> => {
    const domains: string[] = await Promise.all(inputUrls.map(async (inputUrl: string, index:number): Promise<string> => {
        const text: string = await fetchText(inputUrl);
        const rawFilePath: string = path.join(__dirname, "..", "raw", `${targetFile}-input${index}.txt`);
        await writeFile(rawFilePath, text, { encoding: "utf8" });
        const filteredDomains: string[] = filterDomains(text);

        if (isHebrewFile(inputUrl)) {
            filteredDomains.push("buyme.co.il");
        }

        stats[inputUrl] = filteredDomains.length;
        return filteredDomains.join("\n");
    }));
    return getUniqueLinesSorted(domains).join("\n");
};

export const filterDomains = (content: string): string[] => {
    const matches: Set<string> = new Set<string>();
    const regex = /^\|\|([a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+)\^\$?$/gm;
    let m;
    while ((m = regex.exec(content)) !== null) {
        if (m.index === regex.lastIndex) {
            regex.lastIndex++;
        }
        if (m.length >= 2) {
            matches.add(m[1]);
        }
    }
    return Array.from(matches).sort();
};

export const parse = async (): Promise<Stats> => {
    const stats: Stats = {};
    const input: InputType = getInput();
    await Promise.all(Object.keys(input).map(async (targetFile: string) => {
        const targetFilename = `${targetFile}.txt`;
        const targetFilePath: string = path.join(__dirname, "..", "generated", targetFilename);
        const filteredDomains: string = await fetchAllDomainsForSingleTarget(targetFile, input[targetFile], stats);
        await writeFile(targetFilePath, filteredDomains, "utf-8");
    }));
    return stats;
};
