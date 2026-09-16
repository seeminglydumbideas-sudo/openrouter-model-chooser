import React from 'react';
import {
  BookOpen, Zap, Repeat, AlertTriangle, XCircle, CheckCircle2,
  GitBranch, Sigma, ScrollText
} from 'lucide-react';

const Formula: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <pre className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/80 px-4 py-3 text-[12px] leading-relaxed text-cyan-300 font-mono">
    {children}
  </pre>
);

const Section: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <section className="glass-panel flex flex-col gap-4 rounded-2xl p-5 sm:p-6">
    <h2 className="flex items-center gap-2 text-base font-bold text-white">
      {icon}
      {title}
    </h2>
    <div className="flex flex-col gap-3 text-sm leading-relaxed text-slate-300">
      {children}
    </div>
  </section>
);

const Callout: React.FC<{ tone: 'bad' | 'good' | 'warn'; children: React.ReactNode }> = ({ tone, children }) => {
  const styles = {
    bad: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
    good: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
    warn: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  }[tone];
  const Icon = { bad: XCircle, good: CheckCircle2, warn: AlertTriangle }[tone];
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3.5 py-2.5 text-[13px] ${styles}`}>
      <Icon className="h-4 w-4 mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
};

const DataTable: React.FC<{ headers: string[]; rows: (string | number)[][]; highlightRow?: number }> = ({ headers, rows, highlightRow }) => (
  <div className="overflow-x-auto rounded-lg border border-slate-800">
    <table className="w-full text-left text-[12px]">
      <thead>
        <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400">
          {headers.map(h => <th key={h} className="px-3 py-2 font-semibold whitespace-nowrap">{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className={`border-b border-slate-900 last:border-0 ${i === highlightRow ? 'bg-violet-500/10' : ''}`}>
            {row.map((cell, j) => (
              <td key={j} className={`px-3 py-2 whitespace-nowrap ${j === 0 ? 'font-medium text-white' : 'text-slate-300 font-mono'}`}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const MethodologyView: React.FC = () => {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full">

      <div className="glass-panel flex flex-col gap-2 rounded-2xl p-5 sm:p-6 border-violet-500/30">
        <h1 className="flex items-center gap-2 text-lg font-bold text-white">
          <BookOpen className="h-5 w-5 text-violet-400" />
          How the Chart Recommends Models
        </h1>
        <p className="text-sm text-slate-400 leading-relaxed">
          The scatter plot doesn't just show every model — it highlights a small number of "good deal" picks
          (⚡ Best Budget Knee, 🔁 Value Recovery) computed from the Pareto frontier. None of this is a black box:
          this page documents every formula, the reasoning behind each one, the dead ends we tried and abandoned,
          and the math concepts involved. It reflects an actual back-and-forth: a formula was proposed, tested
          against live pricing data, found to disagree with visual intuition, and revised — twice. That history is
          kept here on purpose, because the failed attempts explain why the current formula looks the way it does.
        </p>
      </div>

      {/* 1. Pareto Frontier */}
      <Section icon={<GitBranch className="h-4.5 w-4.5 text-emerald-400" />} title="1. The Pareto Frontier">
        <p>
          With cost fixed on the X-axis and a capability score (Intelligence / Coding / Agentic Index, etc.) on the Y-axis,
          a model is <strong className="text-white">Pareto-efficient</strong> if no other model is both cheaper-or-equal
          <em> and</em> better-or-equal, with at least one of those strictly true. In plain terms: nothing beats it on
          every axis at once.
        </p>
        <Formula>{`isDominated(m) = ∃ other model o such that:
  cost(o) ≤ cost(m)  AND  score(o) ≥ score(m)
  AND (cost(o) < cost(m)  OR  score(o) > score(m))`}</Formula>
        <p>
          The frontier is the set of models where <code className="text-cyan-300">isDominated</code> is false — every
          "good deal" candidate discussed below is drawn only from this set, never from the full catalog. Implementation:
          <code className="text-cyan-300"> calculateParetoFrontier</code> in <code className="text-slate-400">modelService.ts</code>.
        </p>
      </Section>

      {/* 2. Kneedle / Budget Knee */}
      <Section icon={<Zap className="h-4.5 w-4.5 text-amber-400" />} title="2. Finding the Elbow — Best Budget Knee">
        <p>
          The Pareto frontier can have a dozen efficient models. Which one is the "best deal"? The standard answer in the
          literature is the <strong className="text-white">Kneedle algorithm</strong> (Satopaa, Albrecht, Irwin &amp; Raghavan,
          <em> "Finding a 'Kneedle' in a Haystack: Detecting Knee Points in System Behavior,"</em> ICDCS Workshops, 2011):
          find the point that bulges furthest above the straight line connecting the frontier's two endpoints.
        </p>
        <Formula>{`1. Normalize cost and score to [0, 1] between the frontier's cheapest and priciest model
   (log-scaled first, since the chart's cost axis is logarithmic — see the note on log scale below)
2. For every model m:
     dist(m) = (normScore(m) − normCost(m)) / √2
3. The model with the largest dist(m) is the "knee" — the elbow of the curve
   (only counted if dist(m) > 0.015, else the curve is too flat to have a real elbow)`}</Formula>
        <p>
          <strong className="text-white">Budget Knee</strong> restricts this search to a "budget window" first —
          candidates priced at or below <code className="text-cyan-300">max($2.50, 10 × cheapest-model's-cost)</code> —
          so the knee is found among genuinely low-cost options, not diluted by expensive outliers pulling the secant
          line. If fewer than 3 models fall in that window, it falls back to the cheaper 60% of the frontier, and as a
          last resort just the single cheapest model. Implementation: <code className="text-cyan-300">calculateKneedle</code>
          {' '}and <code className="text-cyan-300">findMarginalGainWinners</code>.
        </p>
        <Callout tone="good">
          <strong>Why log-scale cost?</strong> Model prices span four orders of magnitude ($0.01 to $20+ per million
          tokens). On a linear axis, every cheap model would visually collapse into a single point near zero. Log scale
          makes "3× more expensive" look like the same visual step everywhere on the axis, which is also what a
          budget-conscious comparison actually cares about (relative cost, not absolute dollars) — so all the slope
          math below uses <code className="text-cyan-300">log10(cost)</code>, matching what your eye sees on the chart.
        </Callout>
      </Section>

      {/* Dead end 1: SOTA Knee */}
      <Section icon={<XCircle className="h-4.5 w-4.5 text-slate-500" />} title="Dead End #1: 'Best SOTA Knee' (removed from this chart)">
        <p>
          The same Kneedle search, run without the budget-window restriction, finds the elbow across the <em>entire</em>
          {' '}price range — this was originally shown as a second badge, "Best SOTA Knee." It was removed from the scatter
          plot on request: it added a second badge that was often confusing next to Budget Knee without adding a
          clearly distinct insight for this view. The underlying computation
          (<code className="text-cyan-300">findMarginalGainWinners</code>'s <code className="text-cyan-300">sotaKnee</code>{' '}
          field) still exists and is used elsewhere in the app, by the OpenCode Config tab, to pick a flagship
          image-generation model for a sub-agent spec — a different, narrower use case where a single best-overall pick
          (not a budget-conscious alternative) is exactly what's wanted.
        </p>
      </Section>

      {/* Dead end 2: Best Step-Up (fixed ceiling) */}
      <Section icon={<XCircle className="h-4.5 w-4.5 text-slate-500" />} title="Dead End #2: 'Best Step-Up' — a fixed price ceiling">
        <p>
          The next attempt: find the best-value model <em>above</em> the Budget Knee, but capped at{' '}
          <code className="text-cyan-300">5× the Budget Knee's price</code>, and only counted if it delivered at least
          10% of the frontier's full performance range as a gain (to filter out negligible upgrades).
        </p>
        <p>This was tested against the <strong className="text-white">live OpenRouter API</strong>, not just the bundled demo data, and it failed outright:</p>
        <DataTable
          headers={['Model', 'Cost', 'Intelligence']}
          rows={[
            ['DeepSeek V4 Flash', '$0.08', '34.5'],
            ['GLM 5.3 Flash (Budget Knee)', '$0.12', '41.9'],
            ['GLM 5.3', '$2.15', '44.9'],
            ['GPT-5.6 Sol', '$4.00', '47.1'],
            ['Claude Opus 5', '$10.00', '50.7'],
            ['Claude Fable 5.1', '$20.00', '53.4'],
          ]}
          highlightRow={1}
        />
        <Callout tone="bad">
          Real pricing has a <strong>cliff</strong>: budget models cluster at $0.03–$0.12, then the market jumps straight
          to $2+. A 5× ceiling on a $0.12 Budget Knee caps out at $0.60 — nothing qualifies. Loosening the ceiling to
          reach GLM 5.3 ($2.15) still failed the significance bar (+3 points wasn't enough). The feature was reverted
          entirely: a fixed multiplier tuned on one dataset doesn't survive contact with a real, lumpy market.
        </Callout>
      </Section>

      {/* Value Recovery */}
      <Section icon={<Repeat className="h-4.5 w-4.5 text-violet-400" />} title="3. Value Recovery — the current feature">
        <p>
          The insight that replaced the fixed-ceiling idea came from actually looking at a chart: on the Intelligence
          axis, GLM 5.3 Flash (Budget Knee) is clearly a good elbow. The very next model up, GLM 5.3, costs 18× more for
          only +3 points — a bad step. But the model after <em>that</em>, GPT-5.6 Sol, resumes a good rate. Visually:
          a dip, then a recovery.
        </p>
        <p>
          This is measured as the <strong className="text-white">local marginal rate of return</strong> — how much
          capability you gain per unit of log-cost between two adjacent Pareto points:
        </p>
        <Formula>{`slope(A → B) = ( score(B) − score(A) ) / ( log10(cost(B)) − log10(cost(A)) )`}</Formula>
        <DataTable
          headers={['Step', 'Slope (Δscore / Δlog₁₀cost)']}
          rows={[
            ['GLM 5.3 Flash → GLM 5.3', '2.4'],
            ['GLM 5.3 → GPT-5.6 Sol', '8.2'],
            ['GPT-5.6 Sol → Claude Opus 5', '9.0'],
            ['Claude Opus 5 → Claude Fable 5.1', '9.0'],
          ]}
        />
        <p>
          A step is flagged as a genuine "rebound" only if it's meaningfully better than the step right before it —
          a local minimum in the slope sequence, not just noise:
        </p>
        <Formula>{`ratio = slope(after) / slope(before)
qualifies as a rebound if  ratio > 1.3`}</Formula>
        <Callout tone="warn">
          <strong>A detour we considered and rejected:</strong> multi-objective optimization has a formal concept for
          this — "supported" vs "non-supported" efficient solutions (Steuer, <em>Multiple Criteria Optimization</em>, 1986;
          Branke, Deb, Dierolf &amp; Osswald, <em>"Finding Knees in Multi-objective Optimization,"</em> PPSN 2004). A point
          is "non-supported" if it lies below the chord connecting two other efficient points — checkable by computing
          the frontier's upper concave hull. We tried this, but it assumes you can <em>blend</em> two choices to get an
          intermediate outcome (like a financial portfolio) — you can't mix "GLM Flash" and "Fable 5.1" usage to
          approximate GPT-5.6 Sol. For a one-shot, indivisible choice like picking a single model, that framework
          over-corrects (it would say "skip straight to the most expensive model"). Local slope comparison is the right
          level of analysis for this problem instead.
        </Callout>
      </Section>

      {/* Bug 1: ratio bias */}
      <Section icon={<AlertTriangle className="h-4.5 w-4.5 text-rose-400" />} title="Bug Found #1: ranking by ratio rewarded escaping a worse dip">
        <p>
          The first implementation picked the candidate with the <em>highest ratio</em> among qualifying rebounds. On
          the Agentic Index axis, this broke:
        </p>
        <DataTable
          headers={['Step', 'Slope', 'Ratio vs. prior step']}
          rows={[
            ['GLM 5.3 Flash → GLM 5.3', '1.9', '—'],
            ['GLM 5.3 → Qwen 3.8 Max', '18.7', '9.6× ← visually, the obvious pick'],
            ['Qwen 3.8 Max → Claude Opus 5', '0.2', '—'],
            ['Claude Opus 5 → Claude Fable 5.1', '6.0', '31.3× ← highest ratio, but a weaker segment'],
          ]}
        />
        <Callout tone="bad">
          Claude Fable 5.1's ratio (31.3×) beat Qwen 3.8 Max's (9.6×) purely because it was rebounding from an
          almost-zero dip (0.2) — any decent segment following a near-zero segment produces a huge ratio, regardless
          of how good it is in absolute terms. Qwen's segment (18.7) was objectively the best on the whole frontier,
          but lost because its "prior dip" (1.9) wasn't as extreme.
        </Callout>
        <p>
          <strong className="text-white">Fix:</strong> still require <code className="text-cyan-300">ratio &gt; 1.3</code>{' '}
          to qualify as a real rebound, but rank qualifying candidates by their <em>absolute</em> slope, not the ratio.
        </p>
      </Section>

      {/* Bug 2: decoy pricing */}
      <Section icon={<AlertTriangle className="h-4.5 w-4.5 text-rose-400" />} title="Bug Found #2: always defaulting to the flagship model">
        <p>
          Fixing bug #1 introduced a new problem on the Coding Index axis. Claude Fable 5.1 — the single most expensive
          model in the entire catalog — won again, this time legitimately (its segment genuinely has the best absolute
          slope):
        </p>
        <DataTable
          headers={['Step', 'Slope']}
          rows={[
            ['Grok 4.6 → GPT-5.6 Sol', '4.8'],
            ['GPT-5.6 Sol → Claude Opus 5', '1.5  (weak — the dip)'],
            ['Claude Opus 5 → Claude Fable 5.1', '12.0  ← best slope on the whole frontier'],
          ]}
        />
        <p>
          Mathematically defensible — and yet it kept landing on "just buy the single most expensive thing," which
          defeats the purpose of a budget-conscious recommendation. One hypothesis discussed: commercial pricing
          sometimes uses a deliberately extreme, rarely-purchased top tier specifically to make the next tier down look
          reasonable by comparison — the <strong className="text-white">decoy effect</strong> / asymmetric dominance
          effect (Huber, Payne &amp; Puto, <em>"Adding Asymmetrically Dominated Alternatives,"</em> Journal of Consumer
          Research, 1982) and the related <strong className="text-white">compromise effect</strong> (Simonson,
          <em> "Choice Based on Reasons,"</em> Journal of Consumer Research, 1989) — both well-established in "good-better-best"
          tiered-pricing strategy.
        </p>
        <Callout tone="warn">
          We can't prove intent from price data alone — a genuinely more expensive, better-trained model is
          observationally identical to a deliberate anchor. A hard rule ("never recommend the priciest model in the
          catalog") was considered and rejected: it's speculative (is it every family, only commercial ones, does a
          challenger even follow the same playbook as the market leader?), and it breaks thin frontiers outright — a
          Text-to-Image axis with only 2–3 Pareto models would have its only possible candidate always be "the top,"
          permanently disabling the feature for that view.
        </Callout>
      </Section>

      {/* Final fix: boundary weighting */}
      <Section icon={<Sigma className="h-4.5 w-4.5 text-cyan-400" />} title="4. The Fix — Boundary-Distance Weighting">
        <p>
          Instead of a rule about companies or pricing intent, the final version uses a purely statistical property that
          needs no assumptions about who is behind a given price: an estimate sitting at the very <strong className="text-white">edge</strong>{' '}
          of your observed data is inherently less trustworthy than one in the interior, because it only has
          corroborating data on one side (nothing pricier exists to confirm the trend continues). This is the standard
          <strong className="text-white"> boundary-bias problem</strong> in local/kernel regression (Cleveland,
          <em> "Robust Locally Weighted Regression and Smoothing Scatterplots,"</em> 1979; Fan &amp; Gijbels, <em>Local
          Polynomial Modelling and Its Applications,</em> 1996).
        </p>
        <p>Every qualifying rebound candidate is discounted by how close it sits to the <em>center</em> of the frontier's own price range:</p>
        <Formula>{`boundaryDistance(m) = min( logCost(m) − logCost(cheapest), logCost(priciest) − logCost(m) )
                       / ( (logCost(priciest) − logCost(cheapest)) / 2 )
                       →  0 at either price extreme, 1 exactly at the center

weight(m) = FLOOR + (1 − FLOOR) × boundaryDistance(m)      [FLOOR = 0.15]

score(m)  = slope(m) × weight(m)

→ pick the qualifying candidate with the highest score`}</Formula>
        <Callout tone="good">
          This self-normalizes per axis and per chart — it needs no knowledge of companies, families, or whether a
          challenger copies a leader's pricing playbook, and it degrades gracefully: a thin, 3-point frontier (like
          Text-to-Image) can still trigger the badge, just with a milder discount (thanks to the floor), rather than
          being permanently blocked. Re-run against live pricing after the fix: Coding now correctly picks GPT-5.6 Sol
          instead of Claude Fable 5.1, while Intelligence and Agentic — which were already correct — are unaffected.
        </Callout>
        <p className="text-slate-400 text-[13px]">
          Honest limitation: this resolves "stop always defaulting to the priciest model." It does not, and cannot,
          recover a pick like "Claude Opus 5" specifically when Opus 5 itself sits mathematically at a local dip rather
          than a rebound — the feature can only point to genuine rebounds, not to "close enough to the best, for
          notably less."
        </p>
      </Section>

      {/* Glossary */}
      <Section icon={<ScrollText className="h-4.5 w-4.5 text-slate-400" />} title="Glossary of math concepts used">
        <ul className="flex flex-col gap-2.5 list-disc pl-5 marker:text-slate-600">
          <li><strong className="text-white">Pareto dominance:</strong> model A dominates B if A is at least as good as B on every axis, and strictly better on at least one.</li>
          <li><strong className="text-white">Log scale:</strong> plotting <code className="text-cyan-300">log10(cost)</code> instead of raw cost so that equal ratios (2×, 10×) occupy equal visual distance — matches how humans compare prices and how the chart itself is drawn.</li>
          <li><strong className="text-white">Slope / marginal rate of return:</strong> how much a metric changes per unit change in another — here, capability gained per unit of log-cost between two adjacent points.</li>
          <li><strong className="text-white">Min–max normalization:</strong> rescaling a value range to [0, 1] so two different-unit axes (dollars, benchmark points) become comparable.</li>
          <li><strong className="text-white">Secant line &amp; perpendicular distance:</strong> the Kneedle algorithm's core trick — draw a straight line between a curve's endpoints, then find the point that bulges furthest away from it.</li>
          <li><strong className="text-white">Ratio / significance threshold:</strong> requiring a change to exceed some multiple (here 1.3×) of a reference value before treating it as a "real" signal instead of noise.</li>
          <li><strong className="text-white">Weighting / handicap function:</strong> multiplying a raw score by a factor between 0 and 1 to discount — but not eliminate — candidates matching some risk profile (here: sitting at the edge of the price range).</li>
          <li><strong className="text-white">Boundary bias:</strong> statistical estimates near the edge of an observed data range are less reliable than interior estimates, because they lack corroborating data on one side.</li>
        </ul>
      </Section>

      {/* References */}
      <Section icon={<BookOpen className="h-4.5 w-4.5 text-slate-400" />} title="References">
        <ul className="flex flex-col gap-2 text-[13px] text-slate-400">
          <li>Satopaa, V., Albrecht, J., Irwin, D., &amp; Raghavan, B. (2011). <em>Finding a "Kneedle" in a Haystack: Detecting Knee Points in System Behavior.</em> ICDCS Workshops.</li>
          <li>Steuer, R. E. (1986). <em>Multiple Criteria Optimization: Theory, Computation, and Application.</em> Wiley.</li>
          <li>Branke, J., Deb, K., Dierolf, H., &amp; Osswald, M. (2004). <em>Finding Knees in Multi-objective Optimization.</em> PPSN VIII.</li>
          <li>Huber, J., Payne, J. W., &amp; Puto, C. (1982). <em>Adding Asymmetrically Dominated Alternatives: Violations of Regularity and the Similarity Hypothesis.</em> Journal of Consumer Research, 9(1).</li>
          <li>Simonson, I. (1989). <em>Choice Based on Reasons: The Case of Attraction and Compromise Effects.</em> Journal of Consumer Research, 16(2).</li>
          <li>Cleveland, W. S. (1979). <em>Robust Locally Weighted Regression and Smoothing Scatterplots.</em> Journal of the American Statistical Association, 74(368).</li>
          <li>Fan, J., &amp; Gijbels, I. (1996). <em>Local Polynomial Modelling and Its Applications.</em> Chapman &amp; Hall.</li>
        </ul>
      </Section>

    </div>
  );
};
