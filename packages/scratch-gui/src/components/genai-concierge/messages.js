/**
 * Words of "生成AI に相談" (issue #1279 / #1280), shared by the step components.
 * The question and the rewrite request sent to the AI stay in Japanese
 * (genai-prompt.js / genai-answer.js); these are only what the student sees.
 */
import { defineMessages } from 'react-intl';

const messages = defineMessages({
    title: {
        defaultMessage: 'Ask a generative AI',
        description: 'Header of the panel for asking the generative AI the class uses',
        id: 'gui.genaiConcierge.title',
    },
    close: {
        defaultMessage: 'Close',
        description: 'Label of the button closing the generative AI panel',
        id: 'gui.genaiConcierge.close',
    },
    stepTrouble: {
        defaultMessage: 'Trouble',
        description: 'Step 1 of asking a generative AI: say what the trouble is',
        id: 'gui.genaiConcierge.stepTrouble',
    },
    stepCopy: {
        defaultMessage: 'Copy and ask',
        description: 'Step 2 of asking a generative AI: copy the question and send it',
        id: 'gui.genaiConcierge.stepCopy',
    },
    stepPaste: {
        defaultMessage: 'Answer to blocks',
        description: "Step 3 of asking a generative AI: paste the AI's answer and turn it into blocks",
        id: 'gui.genaiConcierge.stepPaste',
    },
    stepPasteCode: {
        defaultMessage: 'Answer to code',
        description: "Ruby tab: step 3 of asking a generative AI: paste the AI's answer and put it in the code",
        id: 'gui.genaiConcierge.stepPasteCode',
    },
    nudgeText: {
        defaultMessage: 'Looks like you are stuck. Ask a generative AI?',
        description: 'Offer shown when the student has done nothing for a while',
        id: 'gui.genaiConcierge.nudgeText',
    },
    nudgeOpen: {
        defaultMessage: 'Ask',
        description: 'Button accepting the offer to ask a generative AI',
        id: 'gui.genaiConcierge.nudgeOpen',
    },
    nudgeLater: {
        defaultMessage: 'Later',
        description: 'Button closing the offer for now',
        id: 'gui.genaiConcierge.nudgeLater',
    },
    nudgeOff: {
        defaultMessage: 'Not today',
        description: 'Button turning the offer off for the rest of the day',
        id: 'gui.genaiConcierge.nudgeOff',
    },
    faceLabel: {
        defaultMessage: 'Ask AI',
        description: 'Speech bubble beside the face opening the generative AI panel',
        id: 'gui.genaiConcierge.faceLabel',
    },
    faceLabelShort: {
        defaultMessage: 'AI',
        description: 'Short speech bubble beside the face on a narrow screen',
        id: 'gui.genaiConcierge.faceLabelShort',
    },
    troubleQuestion: {
        defaultMessage: 'What is the trouble?',
        description: 'Question above the kinds of trouble',
        id: 'gui.genaiConcierge.troubleQuestion',
    },
    makePrompt: {
        defaultMessage: 'Make the question',
        description: 'Button making the question for the generative AI',
        id: 'gui.genaiConcierge.makePrompt',
    },
    kindNotWorking: {
        defaultMessage: "It doesn't work the way I want",
        description: 'Kind of trouble: the program does not do what the student wants',
        id: 'gui.genaiConcierge.kind.notWorking',
    },
    starterNotWorking: {
        defaultMessage: 'I want it to ..., but it ...',
        description: 'Sentence to start from for the trouble "does not work"',
        id: 'gui.genaiConcierge.starter.notWorking',
    },
    kindError: {
        defaultMessage: 'An error appears',
        description: 'Kind of trouble: an error appears',
        id: 'gui.genaiConcierge.kind.error',
    },
    starterError: {
        defaultMessage: 'When I ..., the error "..." appears',
        description: 'Sentence to start from for the trouble "an error appears"',
        id: 'gui.genaiConcierge.starter.error',
    },
    kindNext: {
        defaultMessage: "I don't know what to make next",
        description: 'Kind of trouble: the student does not know what to make next',
        id: 'gui.genaiConcierge.kind.next',
    },
    starterNext: {
        defaultMessage: "I've made ... Next I want to ...",
        description: 'Sentence to start from for the trouble "what to make next"',
        id: 'gui.genaiConcierge.starter.next',
    },
    kindHow: {
        defaultMessage: "I don't know how to use a block",
        description: 'Kind of trouble: the student does not know how to use a block',
        id: 'gui.genaiConcierge.kind.how',
    },
    starterHow: {
        defaultMessage: 'Which block should I use to ...?',
        description: 'Sentence to start from for the trouble "how to use a block"',
        id: 'gui.genaiConcierge.starter.how',
    },
    kindHowCommand: {
        defaultMessage: "I don't know how to write a command",
        description: 'Kind of trouble in the Ruby tab: the student does not know how to write a command',
        id: 'gui.genaiConcierge.kind.howCommand',
    },
    starterHowCommand: {
        defaultMessage: 'How should I write ...?',
        description: 'Sentence to start from for the trouble "how to write a command"',
        id: 'gui.genaiConcierge.starter.howCommand',
    },
    kindWrongAnswer: {
        defaultMessage: 'The answer is wrong',
        description: 'Kind of trouble in the Japanese (DNCL) mode: the program prints a wrong answer',
        id: 'gui.genaiConcierge.kind.wrongAnswer',
    },
    starterWrongAnswer: {
        defaultMessage: 'It should be ..., but it shows ...',
        description: 'Sentence to start from for the trouble "the answer is wrong"',
        id: 'gui.genaiConcierge.starter.wrongAnswer',
    },
    kindHowWrite: {
        defaultMessage: "I don't know how to write it",
        description: 'Kind of trouble in the Japanese (DNCL) mode: the student does not know how to write it',
        id: 'gui.genaiConcierge.kind.howWrite',
    },
    starterHowWrite: {
        defaultMessage: 'How should I write ...?',
        description: 'Sentence to start from for the trouble "how to write it"',
        id: 'gui.genaiConcierge.starter.howWrite',
    },
    kindHowThink: {
        defaultMessage: "I don't know how to think about the problem",
        description: 'Kind of trouble in the Japanese (DNCL) mode: the student does not know how to solve the problem',
        id: 'gui.genaiConcierge.kind.howThink',
    },
    starterHowThink: {
        defaultMessage: "In a problem asking for ..., I don't know how to think",
        description: 'Sentence to start from for the trouble "how to think about the problem"',
        id: 'gui.genaiConcierge.starter.howThink',
    },
    kindMoreFun: {
        defaultMessage: 'I want to make it more fun',
        description: 'Kind of trouble: the student wants to make the work more fun',
        id: 'gui.genaiConcierge.kind.moreFun',
    },
    starterMoreFun: {
        defaultMessage: 'I want to make ... more ...',
        description: 'Sentence to start from for the trouble "make it more fun"',
        id: 'gui.genaiConcierge.starter.moreFun',
    },
    serviceQuestion: {
        defaultMessage: 'Which generative AI does your school use?',
        description: 'Development only (?features=genai outside a class): choose the generative AI',
        id: 'gui.genaiConcierge.serviceQuestion',
    },
    serviceUrlPlaceholder: {
        defaultMessage: 'URL of another generative AI (https://…)',
        description: 'Development only: placeholder of the URL of another generative AI',
        id: 'gui.genaiConcierge.serviceUrlPlaceholder',
    },
    serviceUse: {
        defaultMessage: 'Use this',
        description: 'Development only: button choosing the entered URL',
        id: 'gui.genaiConcierge.serviceUse',
    },
    serviceChange: {
        defaultMessage: 'Change the generative AI',
        description: 'Development only: link to choose another generative AI',
        id: 'gui.genaiConcierge.serviceChange',
    },
    copyOpen: {
        defaultMessage: 'Copy and open {name}',
        description: 'Button copying the question and opening the generative AI ({name}: its name, e.g. Gemini)',
        id: 'gui.genaiConcierge.copyOpen',
    },
    partsLabel: {
        defaultMessage: 'Split into {count} parts. Paste and send them one at a time, in order.',
        description: 'Shown when the question was split into parts',
        id: 'gui.genaiConcierge.partsLabel',
    },
    copyPart: {
        defaultMessage: 'Copy part {number}',
        description: 'Button copying one part of a split question',
        id: 'gui.genaiConcierge.copyPart',
    },
    charCount: {
        defaultMessage: '{count} characters',
        description: 'Length of the question',
        id: 'gui.genaiConcierge.charCount',
    },
    split: {
        defaultMessage: 'The AI said it is too long, or it could not be pasted',
        description: 'Link splitting the question into smaller parts',
        id: 'gui.genaiConcierge.split',
    },
    copied: {
        defaultMessage: 'Copied. Paste it into the generative AI (Ctrl+V) and send it.',
        description: 'Shown after the question was copied',
        id: 'gui.genaiConcierge.copied',
    },
    copiedGoBack: {
        defaultMessage: 'Copied. Go back to the generative AI tab, paste it (Ctrl+V) and send it.',
        description: 'Shown after copying again, once the generative AI tab has been opened',
        id: 'gui.genaiConcierge.copiedGoBack',
    },
    copyOnly: {
        defaultMessage: 'Copy',
        description: 'Button copying the question once the generative AI tab has been opened',
        id: 'gui.genaiConcierge.copyOnly',
    },
    reopen: {
        defaultMessage: 'Open {name} again (if you closed its tab)',
        description: 'Link opening the generative AI once more, for a student who closed its tab',
        id: 'gui.genaiConcierge.reopen',
    },
    copyFailed: {
        defaultMessage: "Couldn't copy. Select all of the text below and copy it with Ctrl+C.",
        description: 'Shown when copying to the clipboard failed',
        id: 'gui.genaiConcierge.copyFailed',
    },
    back: {
        defaultMessage: 'Back',
        description: 'Button going back one step',
        id: 'gui.genaiConcierge.back',
    },
    toPaste: {
        defaultMessage: 'Got the answer? Next',
        description: 'Button going on once the generative AI has answered',
        id: 'gui.genaiConcierge.toPaste',
    },
    copyReady: {
        defaultMessage: 'The question is ready. Copy it and send it to {name}.',
        description: 'The one line of step 2 telling what to do ({name}: the generative AI, e.g. Gemini)',
        id: 'gui.genaiConcierge.copyReady',
    },
    checkCopy: {
        defaultMessage: 'Copy and open {name}',
        description: 'Checklist of step 2, item 1: copy the question and open the generative AI',
        id: 'gui.genaiConcierge.checkCopy',
    },
    checkPaste: {
        defaultMessage: 'Paste it into {name} (Ctrl+V) and send it',
        description: 'Checklist of step 2, item 2: paste the question into the generative AI and send it',
        id: 'gui.genaiConcierge.checkPaste',
    },
    checkNext: {
        defaultMessage: 'When the answer comes, press "Next"',
        description: 'Checklist of step 2, item 3: go on once the generative AI has answered',
        id: 'gui.genaiConcierge.checkNext',
    },
    promptCount: {
        defaultMessage: 'Question: {count} characters',
        description: 'Length of the whole question (shown instead of its text)',
        id: 'gui.genaiConcierge.promptCount',
    },
    promptShow: {
        defaultMessage: 'See or edit it',
        description: 'Link opening the text of the question, which the student may edit',
        id: 'gui.genaiConcierge.promptShow',
    },
    promptHide: {
        defaultMessage: 'Hide it',
        description: 'Link closing the text of the question',
        id: 'gui.genaiConcierge.promptHide',
    },
    pasteQuestion: {
        defaultMessage: "Paste {name}'s whole answer",
        description: 'The one line of step 3 ({name}: the generative AI, e.g. Gemini)',
        id: 'gui.genaiConcierge.pasteQuestion',
    },
    convert: {
        defaultMessage: 'Check if it can become blocks',
        description: 'Button checking whether the pasted answer turns into blocks',
        id: 'gui.genaiConcierge.convert',
    },
    convertCode: {
        defaultMessage: 'Check the program',
        description: 'Ruby tab: button checking the pasted answer (it is turned into blocks only to see that it runs)',
        id: 'gui.genaiConcierge.convertCode',
    },
    answerShow: {
        defaultMessage: 'See the answer',
        description: 'Link opening the pasted answer again after it was checked',
        id: 'gui.genaiConcierge.answerShow',
    },
    answerHide: {
        defaultMessage: 'Hide the answer',
        description: 'Link closing the pasted answer',
        id: 'gui.genaiConcierge.answerHide',
    },
    backTo: {
        defaultMessage: 'Go back to "{step}"',
        description: 'Label of a finished step in the progress display, which goes back to it',
        id: 'gui.genaiConcierge.backTo',
    },
    checking: {
        defaultMessage: 'Checking whether it can become blocks…',
        description: 'Shown with a spinner while the pasted answer is being checked',
        id: 'gui.genaiConcierge.checking',
    },
    checkingCode: {
        defaultMessage: 'Checking the program…',
        description: 'Ruby tab: shown with a spinner while the pasted answer is being checked',
        id: 'gui.genaiConcierge.checkingCode',
    },
    convertOk: {
        defaultMessage: 'It can become blocks',
        description: 'Result of the check: the answer turns into blocks',
        id: 'gui.genaiConcierge.convertOk',
    },
    convertNg: {
        defaultMessage: 'It cannot become blocks as it is',
        description: 'Result of the check: the answer does not turn into blocks',
        id: 'gui.genaiConcierge.convertNg',
    },
    convertOkCode: {
        defaultMessage: 'No problem was found in the program',
        description: 'Ruby tab: result of the check: the answer can run as it is',
        id: 'gui.genaiConcierge.convertOkCode',
    },
    convertNgCode: {
        defaultMessage: 'This program has a problem',
        description: 'Ruby tab: result of the check: the answer has a problem',
        id: 'gui.genaiConcierge.convertNgCode',
    },
    fixesTitle: {
        defaultMessage: 'What Smalruby fixed:',
        description: 'Heading of the list of what Smalruby repaired in the answer',
        id: 'gui.genaiConcierge.fixesTitle',
    },
    indexHintsTitle: {
        defaultMessage:
            'Note: the indexes may start at 1. In Smalruby Japanese mode, array indices start at 0.',
        description:
            'Shown under the ✔ of a DNCL answer when it reads past the end of an array (counting from 1)',
        id: 'gui.genaiConcierge.indexHintsTitle',
    },
    indexHint: {
        defaultMessage:
            '{access} reads past the end of the array (the last element is {array}[{last}]). If the problem counts from 1, shift the index by 1, like {fixed}.',
        description: 'One access past the end of an array in a DNCL answer, in the words of the editor warning',
        id: 'gui.genaiConcierge.indexHint',
    },
    lineOf: {
        defaultMessage: 'Line {line}',
        description: 'Where a fix or problem is ({line}: line number)',
        id: 'gui.genaiConcierge.lineOf',
    },
    spriteLineOf: {
        defaultMessage: '"{sprite}" line {line}',
        description: 'Where a fix or problem is in an answer for several sprites',
        id: 'gui.genaiConcierge.spriteLineOf',
    },
    spriteOf: {
        defaultMessage: '"{sprite}"',
        description: 'Which sprite a problem is about',
        id: 'gui.genaiConcierge.spriteOf',
    },
    problemNoProgram: {
        defaultMessage: 'No program was found in what you pasted',
        description: 'Problem: the pasted answer has no program',
        id: 'gui.genaiConcierge.problemNoProgram',
    },
    problemMissingSound: {
        defaultMessage: 'There is no sound "{name}" (sounds you can use: {names})',
        description: 'Problem: the answer plays a sound the sprite does not have',
        id: 'gui.genaiConcierge.problemMissingSound',
    },
    problemMissingSoundNone: {
        defaultMessage: 'There is no sound "{name}" (this sprite has no sounds)',
        description: 'Problem: the answer plays a sound, and the sprite has none',
        id: 'gui.genaiConcierge.problemMissingSoundNone',
    },
    problemMissingCostume: {
        defaultMessage: 'There is no costume "{name}" (costumes you can use: {names})',
        description: 'Problem: the answer uses a costume the sprite does not have',
        id: 'gui.genaiConcierge.problemMissingCostume',
    },
    problemMissingCostumeNone: {
        defaultMessage: 'There is no costume "{name}"',
        description: 'Problem: the answer uses a costume, and the sprite has none',
        id: 'gui.genaiConcierge.problemMissingCostumeNone',
    },
    problemOtherSprite: {
        defaultMessage: 'It also changes "{sprite}". Ask for only "{only}"',
        description: 'Problem in the Ruby tab: the answer changes another sprite than the one in the editor',
        id: 'gui.genaiConcierge.problemOtherSprite',
    },
    problemClassDef: {
        defaultMessage: 'A class definition ({source}) cannot become blocks',
        description: 'Problem: the answer is written as a Ruby class',
        id: 'gui.genaiConcierge.problemClassDef',
    },
    problemRaw: {
        defaultMessage: '{count} places do not become ordinary blocks',
        description: 'Problem: some lines would stay as "Ruby" blocks',
        id: 'gui.genaiConcierge.problemRaw',
    },
    problemClassDefCode: {
        defaultMessage: 'A class definition ({source}) cannot be used in Smalruby',
        description: 'Ruby tab: problem: the answer is written as a Ruby class',
        id: 'gui.genaiConcierge.problemClassDefCode',
    },
    problemRawCode: {
        defaultMessage: '{count} places are written in a way Smalruby cannot use',
        description: 'Ruby tab: problem: some lines are written in a way Smalruby cannot run',
        id: 'gui.genaiConcierge.problemRawCode',
    },
    rubyShow: {
        defaultMessage: 'See the Ruby',
        description: 'Link showing the repaired Ruby',
        id: 'gui.genaiConcierge.rubyShow',
    },
    rubyHide: {
        defaultMessage: 'Hide the Ruby',
        description: 'Link hiding the repaired Ruby',
        id: 'gui.genaiConcierge.rubyHide',
    },
    programShow: {
        defaultMessage: 'See the program',
        description: 'Link showing the DNCL program of the answer (Japanese mode of the Ruby tab)',
        id: 'gui.genaiConcierge.programShow',
    },
    programHide: {
        defaultMessage: 'Hide the program',
        description: 'Link hiding the DNCL program of the answer (Japanese mode of the Ruby tab)',
        id: 'gui.genaiConcierge.programHide',
    },
    reflectionLabel: {
        defaultMessage: 'In one line of your own words, write what will change (required)',
        description: 'Label of the one-line reflection before putting the blocks in',
        id: 'gui.genaiConcierge.reflectionLabel',
    },
    applyReplaces: {
        defaultMessage: 'Putting them in replaces the blocks of {names}.',
        description: 'Which sprites the blocks are replaced in ({names}: sprite names)',
        id: 'gui.genaiConcierge.applyReplaces',
    },
    apply: {
        defaultMessage: 'Put these blocks in',
        description: 'Button putting the AI blocks in',
        id: 'gui.genaiConcierge.apply',
    },
    applyReplacesCode: {
        defaultMessage: 'This replaces the code of {names} in the editor (Ctrl+Z takes it back).',
        description: 'Ruby tab: which sprite the code is replaced in ({names}: sprite name)',
        id: 'gui.genaiConcierge.applyReplacesCode',
    },
    applyCode: {
        defaultMessage: 'Use this code',
        description: 'Ruby tab: button putting the AI code in the editor',
        id: 'gui.genaiConcierge.applyCode',
    },
    selfCode: {
        defaultMessage: 'Write it myself',
        description: 'Ruby tab: button closing the panel to write the program without the AI code',
        id: 'gui.genaiConcierge.selfCode',
    },
    self: {
        defaultMessage: 'Build it myself',
        description: 'Button closing the panel to build the program without the AI blocks',
        id: 'gui.genaiConcierge.self',
    },
    nextAnswerLabel: {
        defaultMessage: "Copy the request and send it to {name}. When {name} answers again, paste the new answer here",
        description: 'Label of the field for the AI\'s rewritten answer, under a failed check ({name}: e.g. Gemini)',
        id: 'gui.genaiConcierge.nextAnswerLabel',
    },
    nextAnswerPlaceholder: {
        defaultMessage: "Paste {name}'s new answer here (Ctrl+V)",
        description: 'Placeholder of the field for the AI\'s rewritten answer ({name}: e.g. Gemini)',
        id: 'gui.genaiConcierge.nextAnswerPlaceholder',
    },
    copyRewrite: {
        defaultMessage: 'Copy a request to rewrite it',
        description: 'Button copying a request asking the AI to rewrite the program',
        id: 'gui.genaiConcierge.copyRewrite',
    },
    takeover: {
        defaultMessage: 'Leave it to Rubytee',
        description: 'Button offered after two failed checks, in a class using Rubytee',
        id: 'gui.genaiConcierge.takeover',
    },
    takeoverRunning: {
        defaultMessage: 'Rubytee (an AI) is rewriting the program ({count} / {max}). It may take a minute or two.',
        description: 'While Rubytee rewrites the program ({count}: the try, {max}: the most tries)',
        id: 'gui.genaiConcierge.takeoverRunning',
    },
    takeoverCancel: {
        defaultMessage: 'Stop',
        description: 'Button stopping Rubytee rewriting the program',
        id: 'gui.genaiConcierge.takeoverCancel',
    },
    takeoverBy: {
        defaultMessage: 'Rubytee (an AI) made this version. Check that it does what you want.',
        description: 'Shown above the blocks of a version Rubytee made',
        id: 'gui.genaiConcierge.takeoverBy',
    },
    takeoverFailed: {
        defaultMessage:
            'Rubytee rewrote it {count} times, but it still could not be turned into blocks. Build it yourself, or ask again.',
        description: 'When none of the versions Rubytee made turned into blocks ({count}: tries)',
        id: 'gui.genaiConcierge.takeoverFailed',
    },
    takeoverFailedCode: {
        defaultMessage:
            'Rubytee rewrote it {count} times, but a problem is still left. Write it yourself, or ask again.',
        description: 'Ruby tab: when none of the versions Rubytee made passed the check ({count}: tries)',
        id: 'gui.genaiConcierge.takeoverFailedCode',
    },
    takeoverErrorRate: {
        defaultMessage: 'You have used Rubytee many times. Try again in about {minutes} minutes.',
        description: 'Rubytee refused: too many requests ({minutes}: minutes to wait)',
        id: 'gui.genaiConcierge.takeoverErrorRate',
    },
    takeoverErrorTooLong: {
        defaultMessage: 'The program is too long to leave to Rubytee.',
        description: 'The program is too long to send to Rubytee',
        id: 'gui.genaiConcierge.takeoverErrorTooLong',
    },
    takeoverErrorInput: {
        defaultMessage: 'The program has words that cannot be sent to Rubytee.',
        description: 'Rubytee refused the words of the program',
        id: 'gui.genaiConcierge.takeoverErrorInput',
    },
    takeoverError: {
        defaultMessage: 'Could not reach Rubytee. Wait a little and try again.',
        description: 'Rubytee could not answer (network or AI error)',
        id: 'gui.genaiConcierge.takeoverError',
    },
    switchBefore: {
        defaultMessage: 'Original program',
        description: 'Switch button: the program before the AI blocks were put in',
        id: 'gui.genaiConcierge.switchBefore',
    },
    switchAfter: {
        defaultMessage: 'The AI\'s version',
        description: 'Switch button: the program the AI suggested',
        id: 'gui.genaiConcierge.switchAfter',
    },
    switchState: {
        defaultMessage: 'Now {side} is in ({names}). Click the flag and compare how they move.',
        description: 'Which version is in the sprites now',
        id: 'gui.genaiConcierge.switchState',
    },
    switchKeep: {
        defaultMessage: 'Switching keeps what you changed on each side.',
        description: 'Note that the student own changes survive switching',
        id: 'gui.genaiConcierge.switchKeep',
    },
    memo: {
        defaultMessage: 'Your note: {text}',
        description: 'The reflection the student wrote, shown after putting the blocks in',
        id: 'gui.genaiConcierge.memo',
    },
    changesTitle: {
        defaultMessage: "Blocks the AI's version adds or changes",
        description: 'Heading of the list of blocks the AI version adds or changes',
        id: 'gui.genaiConcierge.changesTitle',
    },
    changesNone: {
        defaultMessage: 'No blocks are added or changed.',
        description: 'The AI version adds or changes no blocks',
        id: 'gui.genaiConcierge.changesNone',
    },
    changesLegend: {
        defaultMessage: 'The blocks with a pink frame are added, a dashed one changed. Click a line to go to its block.',
        description: 'How the marked blocks look in the editor, and that a line of the list brings its block into view',
        id: 'gui.genaiConcierge.changesLegend',
    },
    linesTitle: {
        defaultMessage: "Lines the AI's version adds, changes or removes",
        description: 'Ruby tab: title of the line diff of the code now and the AI code',
        id: 'gui.genaiConcierge.linesTitle',
    },
    linesCount: {
        defaultMessage: '{added} lines added, {changed} changed, {removed} removed',
        description: 'Ruby tab: how many lines the AI code adds, changes and removes, before it is put in',
        id: 'gui.genaiConcierge.linesCount',
    },
    linesNone: {
        defaultMessage: 'No line is added, changed or removed.',
        description: 'Ruby tab: the AI code is the same as the code now',
        id: 'gui.genaiConcierge.linesNone',
    },
    linesDone: {
        defaultMessage: '{added} lines were added and {changed} changed.',
        description: 'Ruby tab: how many lines the AI version added and changed, once it is in',
        id: 'gui.genaiConcierge.linesDone',
    },
    linesLegend: {
        defaultMessage:
            'The lines with a bar by the line numbers are added, those with a dashed bar changed. Lines removed have no mark.',
        description: 'Ruby tab: how the marked lines look in the editor',
        id: 'gui.genaiConcierge.linesLegend',
    },
    changeAdded: {
        defaultMessage: '"{block}" is added',
        description: 'A block added ({block}: the words of the block)',
        id: 'gui.genaiConcierge.changeAdded',
    },
    changeAddedIn: {
        defaultMessage: '"{block}" is added in "{script}"',
        description: 'A block added in a script ({script}: its top block)',
        id: 'gui.genaiConcierge.changeAddedIn',
    },
    changeChanged: {
        defaultMessage: '"{before}" becomes "{block}"',
        description: 'A block changed ({before}: the block now)',
        id: 'gui.genaiConcierge.changeChanged',
    },
    changeRemoved: {
        defaultMessage: '"{block}" is taken away',
        description: 'A block the AI version does not have',
        id: 'gui.genaiConcierge.changeRemoved',
    },
    changesMore: {
        defaultMessage: 'and {count} more',
        description: 'More changes than the list shows',
        id: 'gui.genaiConcierge.changesMore',
    },
    again: {
        defaultMessage: 'Ask again',
        description: 'Button starting a new consultation',
        id: 'gui.genaiConcierge.again',
    },
    finish: {
        defaultMessage: 'Close with this',
        description: 'Button closing the panel after putting the blocks in',
        id: 'gui.genaiConcierge.finish',
    },
});

// PROBLEM_KINDS id (genai-prompt.js) → the words the student sees.
const KIND_MESSAGES = {
    'not-working': { label: messages.kindNotWorking, starter: messages.starterNotWorking },
    error: { label: messages.kindError, starter: messages.starterError },
    next: { label: messages.kindNext, starter: messages.starterNext },
    how: { label: messages.kindHow, starter: messages.starterHow },
    'how-command': { label: messages.kindHowCommand, starter: messages.starterHowCommand },
    'more-fun': { label: messages.kindMoreFun, starter: messages.starterMoreFun },
    'wrong-answer': { label: messages.kindWrongAnswer, starter: messages.starterWrongAnswer },
    'how-write': { label: messages.kindHowWrite, starter: messages.starterHowWrite },
    'how-think': { label: messages.kindHowThink, starter: messages.starterHowThink },
};

export { KIND_MESSAGES };
export default messages;
