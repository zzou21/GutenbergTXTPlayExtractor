import requests, re, json, os
from collections import defaultdict

class GutenbergTXTPlayExtractor:
    def __init__(self, htmlURLList, jsonStorageOutputFolderPath):
        self.htmlURLList = htmlURLList
        self.jsonStorageOutputFolderPath = jsonStorageOutputFolderPath
        os.makedirs(self.jsonStorageOutputFolderPath, exist_ok = True)

    def webFetchUsingSingleURL(self, url):
        try:
            webContent = requests.get(url)
            webContent.raise_for_status()
            return webContent.text

        except requests.RequestException as e:
            print(f"Error accessing URL: {url}. Error as {e}")
            return None
            
    def determineFormatOfExtraction(self, lines):
        inlinePattern = re.compile(r'^([A-Z][A-Z\-\.]+)\b(?:\s|:)(.*)')
        blockPattern = re.compile(r'^([A-Z][A-Z\s\-\.]+?)(?:[\.:])?$')

        inlineMatchesCount = sum(1 for line in lines if inlinePattern.match(line))
        blockMatchesCount = sum(1 for line in lines if blockPattern.match(line))
        
        return self.txtParseSingleTXTInline(lines) if inlineMatchesCount >= blockMatchesCount else self.txtParseSingleTXTBlock(lines)

    def cleanExtractedPlainText(self, lines):
        startMarkersPrimary = ["DRAMATIS PERSONAE", "DRAMATIS PERSONÆ", "Dramatis Personæ", "Dramatis Personae", "*** START OF THE PROJECT GUTENBERG"]
        startMarkersSecondary = ["ACT I.", "ACT 1.", "ACT 1", "ACT I", "FIRST ACT", "First Act", "PROLOGUE", "Prologue"]
        startMarkersThird = ["SCENE", "Scene"]
        endMarkers = ["*** END OF THE PROJECT GUTENBERG EBOOK", "NOTES:"]

        beginningIndex = 0
        endIndex = len(lines)

        for indexCount, line in enumerate(lines):
            if any(marker in line for marker in startMarkersPrimary):
                beginningIndex = indexCount
                break
        for indexTracker in range(beginningIndex, len(lines)):
            if any(marker in lines[indexTracker] for marker in startMarkersSecondary):
                beginningIndex = indexTracker
                break
        for indexTracker in range(beginningIndex, len(lines)):
            if any(marker in lines[indexTracker] for marker in startMarkersThird):
                beginningIndex = indexTracker
                break
        for indexTracker in range(beginningIndex, len(lines)):
            if any(marker in lines[indexTracker] for marker in endMarkers):
                endIndex = indexTracker
                break

        return lines[beginningIndex:endIndex]

    def txtParseSingleTXTInline(self, fetchedContent):
        speakerPatternRecognitionAllCaps = re.compile(r'^([A-Z][A-Z\-\.]+)\b(?:\s|:)(.*)')
        currentSpeakingCharacter = None
        dialogueDictionary = defaultdict(list)

        for line in fetchedContent:
            match = speakerPatternRecognitionAllCaps.match(line)
            if match:
                speaker = match.group(1).strip()
                dialogue = match.group(2).strip()
                currentSpeakingCharacter = speaker
                if dialogue:
                    dialogueDictionary[currentSpeakingCharacter].append(dialogue)
            elif currentSpeakingCharacter:
                dialogueDictionary[currentSpeakingCharacter].append(dialogue)

        return dict(dialogueDictionary)            

    def txtParseSingleTXTBlock(self, fetchedContent):
        speakerPatternRecognitionAllCapsBlock = re.compile(r'^([A-Z][A-Z\s\-\.]+?)(?:[\.:])?$')
        currentSpeakingCharacter = None
        dialogueDictionary = defaultdict(list)

        for line in fetchedContent:
            match = speakerPatternRecognitionAllCapsBlock.match(line)
            if match:
                currentSpeakingCharacter = match.group(1).strip()
            elif currentSpeakingCharacter:
                dialogueDictionary[currentSpeakingCharacter].append(line.strip())
        return dict(dialogueDictionary)
    
    def saveToJson(self, dialogueDictionary, jsonOutputFileName):
        outputPath = os.path.join(self.jsonStorageOutputFolderPath, jsonOutputFileName)
        print(outputPath)
        with open(outputPath, "w", encoding="utf-8") as jsonStorageSingleFile:
            json.dump(dialogueDictionary, jsonStorageSingleFile, indent=4, ensure_ascii=False)

    def run(self):
        for url in self.htmlURLList:
            webFetchContent = self.webFetchUsingSingleURL(url)
            if not webFetchContent: continue
            lines = [line.strip() for line in webFetchContent.splitlines() if line.strip()]
            gutenbergPrefix = "TheProjectGutenbergeBookof"
            playName = lines[0].replace(" ", "")
            playName = playName[playName.index(gutenbergPrefix):]
            if playName.startswith(gutenbergPrefix):
                playName = playName[len(gutenbergPrefix):]
            cleanedLines = self.cleanExtractedPlainText(lines)
            processedPlayDict = self.determineFormatOfExtraction(cleanedLines)
            fileName = playName + ".json"
            self.saveToJson(processedPlayDict, fileName)

if __name__ == "__main__":
    htmlWebLinkList = [
        "https://www.gutenberg.org/cache/epub/1523/pg1523.txt",
        "https://www.gutenberg.org/cache/epub/75666/pg75666.txt"
    ]
    # Currently only works when speaker names are in all caps
    jsonStorageFolderPath = "/Users/Jerry/Desktop/CMAC530FinProj/jsonStorage"
    gutenbergExtractor = GutenbergTXTPlayExtractor(htmlWebLinkList, jsonStorageFolderPath)
    gutenbergExtractor.run()