import { DEVICE_TYPE_TAXONOMY } from './llm'

/** Map long FDA strings to hackathon-friendly taxonomy labels. */
export function mapToTaxonomy(
  fdaLabel: string,
  manufacturer: string,
  model: string,
): string {
  const text = `${fdaLabel} ${manufacturer} ${model}`.toLowerCase()

  const rules: Array<{ re: RegExp; type: string }> = [
    { re: /\b(defibrillator|aed|cardiac|pacemaker|pacing)\b/i, type: 'Defibrillator/Cardiac' },
    { re: /\b(infusion|pump|syringe|plum)\b/i, type: 'Infusion/Pump' },
    { re: /\b(monitor|monitoring|telemetry|oximetry|physiological)\b/i, type: 'Patient Monitoring' },
    { re: /\b(ventilator|respiratory)\b/i, type: 'Ventilator/Respiratory' },
    { re: /\b(mri|ct|imaging|radiology|x-ray)\b/i, type: 'Imaging/Radiology' },
    { re: /\b(ultrasound|sonograph)\b/i, type: 'Ultrasound' },
    { re: /\b(endoscop|colonoscope|hysteroscope|cystoscope|laparoscop)\b/i, type: 'Endoscopy' },
    { re: /\b(bed|stretcher|gurney)\b/i, type: 'Patient Monitoring' },
    { re: /\b(analyzer|laboratory|lab)\b/i, type: 'Diagnostic/Lab' },
    { re: /\b(surgical|electrosurg|scalpel)\b/i, type: 'Surgical' },
    { re: /\b(steriliz)\b/i, type: 'Sterilization' },
    { re: /\b(dialysis)\b/i, type: 'Dialysis' },
    { re: /\b(thermometer|temperature)\b/i, type: 'Patient Monitoring' },
    { re: /\b(gas|carbon-dioxide|co2)\b/i, type: 'Diagnostic/Lab' },
    { re: /\b(rasp|drill|orthopedic)\b/i, type: 'Surgical' },
  ]

  for (const { re, type } of rules) {
    if (re.test(text)) return type
  }

  const trimmed = fdaLabel.trim()
  if ((DEVICE_TYPE_TAXONOMY as readonly string[]).includes(trimmed)) {
    return trimmed
  }

  if (trimmed.length > 60) {
    return 'Other'
  }

  return trimmed
}
