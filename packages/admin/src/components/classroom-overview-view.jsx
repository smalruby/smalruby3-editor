/**
 * クラス・課題 俯瞰ダッシュボード (EPIC #1073, design 2026-07-19).
 *
 * 集計対象は **課題（1授業）= `Classrooms`** の全件。クラス（学級）=
 * `ClassroomGroups` は集計しないので、件数の文言は「課題」と呼ぶ
 * （用語辞典: docs/admin/README.md・#1131）。
 *
 * 「どんな課題がどれくらい作られているか」を、作成の推移・内容の充実度・
 * テーマ傾向の 3 軸で掴み、みんなの課題に載せると有益そうな候補を見える化
 * する（人気/提出数ではなく中身と傾向で判断）。チャートは外部ライブラリを
 * 使わず CSS 横棒で描く。
 */
import PropTypes from 'prop-types';
import {useEffect, useState} from 'react';
import {fetchClassroomOverview} from '../lib/admin-api.js';

// A labelled horizontal bar; width is relative to the row's max value.
const Bar = ({label, count, max, testid}) => (
    <div
        className="admin-bar-row"
        data-testid={testid}
    >
        <span className="admin-bar-label">{label}</span>
        <span className="admin-bar-track">
            <span
                className="admin-bar-fill"
                style={{width: `${max > 0 ? Math.round((count / max) * 100) : 0}%`}}
            />
        </span>
        <span className="admin-bar-count">{count}</span>
    </div>
);

Bar.propTypes = {
    count: PropTypes.number.isRequired,
    label: PropTypes.string.isRequired,
    max: PropTypes.number.isRequired,
    testid: PropTypes.string
};

const RICHNESS_LABELS = {
    0: '中身なし',
    1: '説明のみ',
    2: '説明が複数ページ',
    3: '画像 or スターター付き',
    4: '画像＋スターター（充実）'
};

const ClassroomOverviewView = ({onOpenCandidate}) => {
    const [data, setData] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchClassroomOverview()
            .then(setData)
            .catch(err => setError(err.message));
    }, []);

    if (error) {
        return (<p
            className="admin-error"
            data-testid="overview-error"
        >{error}</p>);
    }
    if (!data) return <p data-testid="overview-loading">{'集計中…'}</p>;

    const trendMax = Math.max(1, ...data.creationTrend.map(t => t.count));
    const richMax = Math.max(1, ...data.richnessDistribution.map(r => r.count));
    const kwMax = Math.max(1, ...data.themeKeywords.map(k => k.count));

    return (
        <div data-testid="overview-view">
            <div
                className="admin-cards"
                data-testid="overview-summary"
            >
                <div className="admin-card">
                    <span className="admin-card-num">{data.summary.total}</span>
                    <span className="admin-card-label">{'課題総数'}</span>
                </div>
                <div className="admin-card">
                    <span className="admin-card-num">{data.summary.active}</span>
                    <span className="admin-card-label">{'利用中'}</span>
                </div>
                <div className="admin-card">
                    <span className="admin-card-num">{data.summary.archived}</span>
                    <span className="admin-card-label">{'アーカイブ'}</span>
                </div>
                <div className="admin-card">
                    <span className="admin-card-num">{data.summary.recent30d}</span>
                    <span className="admin-card-label">{'直近30日の新規'}</span>
                </div>
            </div>

            <section className="admin-section">
                <h3>{'作成の推移（月別）'}</h3>
                {data.creationTrend.length === 0 ? (
                    <p className="admin-meta">{'データがありません。'}</p>
                ) : data.creationTrend.map(t => (
                    <Bar
                        count={t.count}
                        key={t.month}
                        label={t.month}
                        max={trendMax}
                    />
                ))}
            </section>

            <section className="admin-section">
                <h3>{'内容の充実度'}</h3>
                {data.richnessDistribution.map(r => (
                    <Bar
                        count={r.count}
                        key={r.score}
                        label={RICHNESS_LABELS[r.score]}
                        max={richMax}
                    />
                ))}
            </section>

            <section className="admin-section">
                <h3>{'みんなの課題に有益そうな候補'}</h3>
                <p className="admin-meta">
                    {'内容が充実していて、まだ みんなの課題 に無さそうな課題です。'}
                    {'共有は先生本人が CC BY で行うため、作成した先生に共有をおすすめしてください。'}
                </p>
                {data.candidates.length === 0 ? (
                    <p
                        className="admin-meta"
                        data-testid="overview-candidates-empty"
                    >{'候補はまだありません。'}</p>
                ) : (
                    <ul
                        className="admin-list"
                        data-testid="overview-candidates"
                    >
                        {data.candidates.map(c => (
                            <li key={c.classroomId}>
                                <button
                                    data-classroom-id={c.classroomId}
                                    data-testid={`overview-candidate-${c.classroomId}`}
                                    type="button"
                                    onClick={onOpenCandidate}
                                >
                                    <strong>{c.assignmentName || '(課題名なし)'}</strong>
                                    {c.likelyShared ? (
                                        <span className="admin-badge admin-badge-muted">{'共有済みらしい'}</span>
                                    ) : (
                                        <span className="admin-badge admin-badge-ok">{'未共有らしい'}</span>
                                    )}
                                    {c.recommendedForSharing ? (
                                        <span
                                            className="admin-badge admin-badge-ok"
                                            data-testid={`overview-candidate-recommended-${c.classroomId}`}
                                        >{'推奨済み'}</span>
                                    ) : null}
                                    <span className="admin-meta">
                                        {/* className はサーバーが未設定を '' に正規化するので、空なら
                                            ラベルごと出さない（「クラス: 」だけが残るのを避ける）。 */}
                                        {c.className ? `クラス: ${c.className} ・ ` : ''}
                                        {`ページ${c.pageCount}`}
                                        {c.hasImages ? '・画像あり' : ''}
                                        {c.hasStarter ? '・スターターあり' : ''}
                                        {` ・ ${String(c.createdAt).slice(0, 10)}`}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="admin-section">
                <h3>{'テーマの傾向（課題名・クラス名の頻出語）'}</h3>
                {data.themeKeywords.length === 0 ? (
                    <p className="admin-meta">{'繰り返し使われている語はまだありません。'}</p>
                ) : data.themeKeywords.map(k => (
                    <Bar
                        count={k.count}
                        key={k.keyword}
                        label={k.keyword}
                        max={kwMax}
                    />
                ))}
            </section>
        </div>
    );
};

ClassroomOverviewView.propTypes = {
    onOpenCandidate: PropTypes.func.isRequired
};

export default ClassroomOverviewView;
