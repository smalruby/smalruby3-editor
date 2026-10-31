/**
 * Words of "生成AI に相談" (issue #1279), shared by the step components.
 * Steps 4 and later (paste back) are reworked in the next sub-issue and keep
 * the prototype's Japanese until then.
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
        defaultMessage: '1 Trouble',
        description: 'Step 1 of asking a generative AI: say what the trouble is',
        id: 'gui.genaiConcierge.stepTrouble',
    },
    stepCopy: {
        defaultMessage: '2 Copy and ask',
        description: 'Step 2 of asking a generative AI: copy the question and send it',
        id: 'gui.genaiConcierge.stepCopy',
    },
    stepPaste: {
        defaultMessage: '3 Paste back',
        description: "Step 3 of asking a generative AI: paste the AI's answer back",
        id: 'gui.genaiConcierge.stepPaste',
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
    troubleQuestion: {
        defaultMessage: 'What is the trouble?',
        description: 'Question above the kinds of trouble',
        id: 'gui.genaiConcierge.troubleQuestion',
    },
    troubleOwnWords: {
        defaultMessage: 'Write it in your own words (required)',
        description: 'Label of the box where the student describes the trouble',
        id: 'gui.genaiConcierge.troubleOwnWords',
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
    serviceCurrent: {
        defaultMessage: 'Ask: {name}',
        description: 'Which generative AI the question goes to',
        id: 'gui.genaiConcierge.serviceCurrent',
    },
    serviceChange: {
        defaultMessage: 'Change',
        description: 'Development only: link to choose another generative AI',
        id: 'gui.genaiConcierge.serviceChange',
    },
    promptLabel: {
        defaultMessage: 'The question to send to the generative AI (you can edit it)',
        description: 'Label of the question the student copies',
        id: 'gui.genaiConcierge.promptLabel',
    },
    copyOpen: {
        defaultMessage: 'Copy and open the generative AI',
        description: 'Button copying the question and opening the generative AI',
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
        defaultMessage: "Couldn't paste it, or the AI said it is too long",
        description: 'Link splitting the question into smaller parts',
        id: 'gui.genaiConcierge.split',
    },
    copied: {
        defaultMessage: 'Copied. Paste it into the generative AI (Ctrl+V) and send it.',
        description: 'Shown after the question was copied',
        id: 'gui.genaiConcierge.copied',
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
        defaultMessage: 'Got an answer? Next',
        description: 'Button going on once the generative AI has answered',
        id: 'gui.genaiConcierge.toPaste',
    },
});

// PROBLEM_KINDS id (genai-prompt.js) → the words the student sees.
const KIND_MESSAGES = {
    'not-working': { label: messages.kindNotWorking, starter: messages.starterNotWorking },
    error: { label: messages.kindError, starter: messages.starterError },
    next: { label: messages.kindNext, starter: messages.starterNext },
    how: { label: messages.kindHow, starter: messages.starterHow },
    'more-fun': { label: messages.kindMoreFun, starter: messages.starterMoreFun },
};

export { KIND_MESSAGES };
export default messages;
