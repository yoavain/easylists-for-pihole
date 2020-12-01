import { AdBlockPlusInput } from "~resources/adBlockPlusInput";
import type { AdBlockPlus } from "~resources/adBlockPlusInput";
import got from "got";
import * as path from "path";
import * as fs from "fs";

const fsPromises = fs.promises;

export type Stats = Record<string, number>;

const getUniqueLinesSorted = (input: string | string[]): string[] => {
    const lines: string[] = (typeof input === "string") ? input.split("\n") : input.join("\n").split("\n");
    return Array.from(new Set(lines)).sort();
};

const fetchAllDomainsForSingleTarget = async (targetFile: string, inputUrl: string, stats?: Stats): Promise<string> => {
    const text: string = await got.get(inputUrl).text();
    const rawFilePath: string = path.join(__dirname, "..", "raw", `${targetFile}-input.txt`);
    await fsPromises.writeFile(rawFilePath, text, { encoding: "utf8" });
    const filteredDomains: string[] = filterDomains(text);
    stats[inputUrl] = filteredDomains.length;
    return getUniqueLinesSorted(filteredDomains).join("\n");
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
    const input: AdBlockPlus[] = AdBlockPlusInput;
    await Promise.all(input.map(async (input: AdBlockPlus) => {
        const targetFilename: string = input.url.split("/").pop();
        const targetFile: string = targetFilename.split(".")[0];
        const targetFilePath: string = path.join(__dirname, "..", "generated", targetFilename);
        const filteredDomains: string = await fetchAllDomainsForSingleTarget(targetFile, input.url, stats);
        await fsPromises.writeFile(targetFilePath, filteredDomains, "utf-8");
    }));
    return stats;
};
