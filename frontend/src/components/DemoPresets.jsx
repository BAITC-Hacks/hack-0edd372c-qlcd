import { useState } from 'react';
import { demoPresets } from '../data/demoPresets';

export default function DemoPresets({ onLoad, disabled }) {
  const [selected, setSelected] = useState('A');
  return <details className="demo-panel">
    <summary>Демо-сценарии <span>7 запросов</span></summary>
    <div className="demo-content">
      <label htmlFor="demo">Сценарий</label>
      <select id="demo" value={selected} onChange={event => setSelected(event.target.value)}>
        {demoPresets.map(preset => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
      </select>
      <button type="button" className="secondary" disabled={disabled} onClick={() => onLoad(demoPresets.find(preset => preset.id === selected).fields)}>Заполнить форму</button>
      <p className="hint">Заполняет условия. Для запроса к API нажмите «Подобрать».</p>
    </div>
  </details>;
}
