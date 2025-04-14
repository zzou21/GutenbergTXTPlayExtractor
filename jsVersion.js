const fs = require("fs");
const https = require("https");

class GutenbergTXTPlayExtractor {
  constructor(htmlURLList, jsonStorageOutputFolderPath) {
    this.htmlURLList = htmlURLList;
    this.jsonStorageOutputFolderPath = jsonStorageOutputFolderPath;

    if (!fs.existsSync(this.jsonStorageOutputFolderPath)) {
      fs.mkdirSync(this.jsonStorageOutputFolderPath, { recursive: true });
    }
  }

  webFetchUsingSingleURL(url) {
    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      }).on("error", (err) => {
        console.error(`Error accessing URL: ${url}`, err);
        resolve(null);
      });
    });
  }

  cleanExtractedPlainText(lines) {
    const startMarkersPrimary = ["DRAMATIS PERSONAE", "DRAMATIS PERSONÆ", "Dramatis Personæ", "Dramatis Personae", "*** START OF THE PROJECT GUTENBERG"];
    const startMarkersSecondary = ["ACT I.", "ACT 1.", "ACT 1", "ACT I", "FIRST ACT", "First Act", "PROLOGUE", "Prologue"];
    const startMarkersThird = ["SCENE", "Scene"];
    const endMarkers = ["*** END OF THE PROJECT GUTENBERG EBOOK", "NOTES:"];

    let beginningIndex = 0;
    let endIndex = lines.length;

    for (let i = 0; i < lines.length; i++) {
      if (startMarkersPrimary.some(marker => lines[i].includes(marker))) {
        beginningIndex = i;
        break;
      }
    }
    for (let i = beginningIndex; i < lines.length; i++) {
      if (startMarkersSecondary.some(marker => lines[i].includes(marker))) {
        beginningIndex = i;
        break;
      }
    }
    for (let i = beginningIndex; i < lines.length; i++) {
      if (startMarkersThird.some(marker => lines[i].includes(marker))) {
        beginningIndex = i;
        break;
      }
    }
    for (let i = beginningIndex; i < lines.length; i++) {
      if (endMarkers.some(marker => lines[i].includes(marker))) {
        endIndex = i;
        break;
      }
    }
    return lines.slice(beginningIndex, endIndex);
  }

  txtParseSingleTXTInline(lines) {
    const pattern = /^([A-Z][A-Z\-\.]+)\b(?:\s|:)(.*)/;
    let currentSpeaker = null;
    const dialogueDict = {};

    for (let line of lines) {
      const match = line.match(pattern);
      if (match) {
        currentSpeaker = match[1].trim();
        const dialogue = match[2].trim();
        if (!dialogueDict[currentSpeaker]) dialogueDict[currentSpeaker] = [];
        if (dialogue) dialogueDict[currentSpeaker].push(dialogue);
      } else if (currentSpeaker) {
        dialogueDict[currentSpeaker].push(line.trim());
      }
    }
    return dialogueDict;
  }

  txtParseSingleTXTBlock(lines) {
    const pattern = /^([A-Z][A-Z\s\-\.]+?)(?:[\.:])?$/;
    let currentSpeaker = null;
    const dialogueDict = {};

    for (let line of lines) {
      const match = line.match(pattern);
      if (match) {
        currentSpeaker = match[1].trim();
        if (!dialogueDict[currentSpeaker]) dialogueDict[currentSpeaker] = [];
      } else if (currentSpeaker) {
        dialogueDict[currentSpeaker].push(line.trim());
      }
    }
    return dialogueDict;
  }

  determineFormatOfExtraction(lines) {
    const inlinePattern = /^([A-Z][A-Z\-\.]+)\b(?:\s|:)(.*)/;
    const blockPattern = /^([A-Z][A-Z\s\-\.]+?)(?:[\.:])?$/;

    let inlineCount = lines.filter(line => line.match(inlinePattern)).length;
    let blockCount = lines.filter(line => line.match(blockPattern)).length;

    return inlineCount >= blockCount
      ? this.txtParseSingleTXTInline(lines)
      : this.txtParseSingleTXTBlock(lines);
    }

  saveToJson(data, fileName) {
    const outputPath = `${this.jsonStorageOutputFolderPath}/${fileName}`;
    const elementsToDelete = ["ACT I", "Act I", "Act V", "Scene"];
    const keysToDelete = Object.keys(data).filter(speaker =>
        elementsToDelete.some(element =>
          speaker.toLowerCase().startsWith(element.toLowerCase())
        )
      );
    for (const speakerToDelete of keysToDelete){
        delete data[speakerToDelete];
    }
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 4), "utf-8");
    console.log(`Saved to: ${outputPath}`);
  }

  async run() {
    for (let url of this.htmlURLList) {
      const content = await this.webFetchUsingSingleURL(url);
      if (!content) continue;

      const lines = content.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      const gutenbergPrefix = "TheProjectGutenbergeBookof";
      let playName = lines[0].replace(/\s/g, "");

      if (playName.includes(gutenbergPrefix)) {
        playName = playName.slice(playName.indexOf(gutenbergPrefix) + gutenbergPrefix.length);
      }

      const cleanedLines = this.cleanExtractedPlainText(lines);
      const processedPlay = this.determineFormatOfExtraction(cleanedLines);
      this.saveToJson(processedPlay, `${playName}.json`);
    }
  }
}

const htmlWebLinkList = [
  "https://www.gutenberg.org/cache/epub/1523/pg1523.txt",
  "https://www.gutenberg.org/cache/epub/75666/pg75666.txt"
];

const outputFolder = "./jsonStorageJS";
const extractor = new GutenbergTXTPlayExtractor(htmlWebLinkList, outputFolder);
extractor.run();