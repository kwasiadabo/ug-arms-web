/**
 * Dashboard and report charts in the crest colours (Recharts).
 *
 * @author Kwasi Adabo Boakye
 */

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { humanize } from '../../utils/format.js';
import { Card, CardHeader, EmptyState } from '../ui/index.js';

// Crest colours, alternating indigo and gold and stepping lightness so neighbouring slices stay distinct.
export const PALETTE = ['#2b1471', '#dfb725', '#7f6fc4', '#8a6a0c', '#ab9fdc', '#ecd068', '#5a47b0', '#f3df8f'];
const tooltip = {
  contentStyle: { borderRadius: 10, border: '1px solid #e5e3ee', fontFamily: 'Manrope', fontSize: 12 },
};

/**
 * Renders a titled card with a bar chart (vertical or horizontal) or a doughnut chart. Labels are made readable and
 * values numeric, and an empty state is shown when there is no data.
 *
 * @param {object} props
 * @param {string} props.title Title.
 * @param {object[]} props.data Rows.
 * @param {'bar'|'pie'} [props.kind='bar'] Chart type.
 * @param {boolean} [props.horizontal] Draw horizontal bars.
 * @param {string} [props.valueKey='value'] Field holding the value.
 * @param {string} [props.nameKey='name'] Field holding the label.
 * @returns {JSX.Element|null}
 */
export function ChartCard({
  title,
  description,
  data,
  kind = 'bar',
  height = 240,
  horizontal,
  valueKey = 'value',
  nameKey = 'name',
  labelFormat = humanize,
  action,
}) {
  const rows = (data || []).map((d) => ({ ...d, label: labelFormat(String(d[nameKey])), value: Number(d[valueKey]) }));
  return (
    <Card>
      <CardHeader title={title} description={description} actions={action} />
      <div className="px-3 py-4" style={{ height }}>
        {!rows.length ? (
          <EmptyState className="py-6" title="No data yet" />
        ) : kind === 'pie' ? (
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={rows}
                dataKey="value"
                nameKey="label"
                innerRadius="55%"
                outerRadius="85%"
                paddingAngle={1.5}
                stroke="#fff"
                isAnimationActive={false}
              >
                {rows.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip {...tooltip} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer>
            <BarChart
              data={rows}
              layout={horizontal ? 'vertical' : 'horizontal'}
              margin={{ left: horizontal ? 8 : -12, right: 12 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#eef0f2" vertical={!horizontal} horizontal={!horizontal} />
              {horizontal ? (
                <>
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 11 }} />
                </>
              ) : (
                <>
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    interval={0}
                    angle={rows.length > 6 ? -25 : 0}
                    textAnchor={rows.length > 6 ? 'end' : 'middle'}
                    height={rows.length > 6 ? 50 : 30}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                </>
              )}
              <Tooltip {...tooltip} cursor={{ fill: '#f5f3fb' }} />
              <Bar
                dataKey="value"
                name="Count"
                fill="#2b1471"
                radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
                maxBarSize={36}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
