import fs from "fs";
import path from "path";

const promptPath = path.join(process.cwd(), "lib/prompts/interviewer.txt");

export const INTERVIEWER_BASE_SYSTEM: string = fs.readFileSync(promptPath, "utf-8");
