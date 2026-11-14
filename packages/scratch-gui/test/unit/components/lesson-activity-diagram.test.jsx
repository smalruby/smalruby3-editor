/* eslint-env jest */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import LessonActivityDiagram from '../../../src/components/lesson-activity-diagram/lesson-activity-diagram.jsx';
import { layoutActivityDiagram } from '../../../src/lib/lessons/activity-diagram/layout';
import { NODE_KINDS } from '../../../src/lib/lessons/activity-diagram/model';
import ja from '../../../src/locales/ja';

const model = (lanes) => ({ lanes });
const lane = (label, scripts) => ({ id: label || 'own', label, targets: [{ name: null, scripts }] });

const quiz = [
    {
        start: 'このスプライトが押されたとき',
        body: [
            { kind: NODE_KINDS.ACTION, label: '「4+3=?」と聞いて待つ' },
            {
                kind: NODE_KINDS.DECISION,
                label: '答え = 7？',
                yes: [{ kind: NODE_KINDS.ACTION, label: '「正解です」と2秒言う' }],
                no: [{ kind: NODE_KINDS.ACTION, label: '「ちがいます」と2秒言う' }],
            },
            { kind: NODE_KINDS.LOOP, label: 'ずっとくり返す', forever: true, body: [] },
        ],
    },
];

const renderDiagram = (layout) =>
    render(
        <IntlProvider locale="ja" messages={ja}>
            <LessonActivityDiagram layout={layout} />
        </IntlProvider>,
    );

describe('LessonActivityDiagram', () => {
    test('draws every symbol of the layout as SVG with the labels as text', () => {
        const layout = layoutActivityDiagram(model([lane(null, quiz)]));
        const { getByTestId, container } = renderDiagram(layout);
        const svg = getByTestId('lesson-activity-diagram');
        expect(svg.tagName.toLowerCase()).toBe('svg');
        expect(svg.getAttribute('viewBox')).toBe(`0 0 ${layout.width} ${layout.height}`);
        expect(svg.getAttribute('aria-label')).toBe('アクティビティ図');
        const count = (shape) => container.querySelectorAll(`[data-shape="${shape}"]`).length;
        expect(count('start')).toBe(1);
        expect(count('end')).toBe(1);
        expect(count('action')).toBe(3);
        expect(count('decision')).toBe(1);
        expect(count('merge')).toBe(1);
        expect(count('loop')).toBe(1);
        expect(count('lane')).toBe(0);
        expect(container.querySelectorAll('[data-edge]').length).toBe(layout.edges.length);
        [
            'このスプライトが押されたとき',
            '「4+3=?」と聞いて待つ',
            '答え = 7？',
            'はい',
            'いいえ',
            'ずっとくり返す',
        ].forEach((text) => expect(svg.textContent).toContain(text));
    });

    test('draws swimlanes with their names when there are 2 lanes', () => {
        const partner = [
            {
                start: '「あいさつ」を受け取ったとき',
                body: [{ kind: NODE_KINDS.ACTION, label: '「やあ」を送る' }],
            },
        ];
        const layout = layoutActivityDiagram(model([lane('あなた', quiz), lane('ロボ', partner)]));
        const { container, getByTestId } = renderDiagram(layout);
        expect(container.querySelectorAll('[data-shape="lane"]').length).toBe(2);
        expect(getByTestId('lesson-activity-diagram').textContent).toContain('ロボ');
    });

    test('draws nothing without a layout', () => {
        const { container } = renderDiagram(null);
        expect(container.querySelector('svg')).toBeNull();
    });
});
