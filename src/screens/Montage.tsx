import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Illustration } from '../components/Illustration'
import { InfoLink } from '../components/InfoLink'
import { NavBar } from '../components/Bars'
import { ErrorState, Loading } from '../components/States'
import { rememberShown } from '../lib/draft'
import { type AssemblyDraft, initialMontage, useMontageFlow } from '../lib/flow'
import { loadPrices, useLoad } from '../lib/prices'
import { assemblyText, previewAssembly, toTariffs } from '../lib/preview'
import { AssemblyEditor } from './konfigurator/AssemblyEditor'
import { PreisLeiste, PreisSheet } from './konfigurator/Preis'

export function Montage() {
  const [prices, retry] = useLoad(loadPrices)
  return (
    <main>
      <NavBar title="Montage" back={{ to: '/', label: 'Start' }} trailing={<InfoLink />} />
      {prices.status === 'loading' && <Loading label="Preise laden" />}
      {prices.status === 'error' && <ErrorState text="Die Preise konnten nicht geladen werden. Prüfe deine Verbindung." onRetry={retry} />}
      {prices.status === 'ready' && <Formular tariffs={toTariffs(prices.data)} />}
    </main>
  )
}

/** Ungültiger gespeicherter Zustand führt zu einem Fehlerzustand mit Zurücksetzen, nie zu einem Absturz. */
function safePreview(...args: Parameters<typeof previewAssembly>) {
  try {
    return previewAssembly(...args)
  } catch {
    return null
  }
}

function Formular({ tariffs }: { tariffs: Record<string, number> }) {
  const [flow, update] = useMontageFlow()
  const navigate = useNavigate()
  const [sheet, setSheet] = useState(false)
  const preview = safePreview(tariffs, flow.draft)
  if (!preview) return <ErrorState text="Deine gespeicherten Angaben passen nicht mehr. Starte neu mit leeren Angaben." onRetry={() => update(initialMontage)} />

  return (
    <>
      <div className="flex flex-col gap-4 px-5 pt-1 pb-40">
        <p className="m-0 -mt-1 text-subhead text-text-secondary">Aufbau oder Abbau, berechnet nach Laufmeter.</p>
        <AssemblyEditor
          draft={flow.draft}
          onChange={(draft: AssemblyDraft) => update({ draft })}
          tariffs={tariffs}
          visual={
            <div className="flex h-[150px] items-center justify-center overflow-hidden rounded-card bg-(image:--illustration-panel) shadow-card">
              {flow.draft.kind === 'kitchen' ? <Illustration name="kitchen" className="h-full w-auto" /> : <Illustration name="service-montage" className="h-[110px] w-auto" />}
            </div>
          }
        />
      </div>
      <PreisLeiste preview={preview} onOpen={() => setSheet(true)} canContinue onContinue={() => {
        rememberShown('montage', preview.state === 'price' ? preview.price.totalCents : null)
        void navigate('/montage/termin')
      }} />
      <PreisSheet
        note="Richtwert auf Basis deiner Angaben. Den Aufwand vor Ort bestätigt der Partner."
        open={sheet}
        onClose={() => setSheet(false)}
        preview={preview}
        describe={() => ({ label: 'Montage / Demontage', detail: assemblyText(flow.draft, tariffs) })}
      />
    </>
  )
}
