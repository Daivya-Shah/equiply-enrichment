/** Fast model/manufacturer keyword → hackathon taxonomy (no API). */
export function inferDeviceTypeFromModel(
  manufacturer: string,
  model: string,
): string | null {
  const mfr = manufacturer.toLowerCase()
  const mdl = model.toLowerCase().replace(/\s+/g, ' ')

  const rules: Array<{ test: (m: string, d: string) => boolean; type: string }> = [
    {
      test: (m) => m.includes('edan'),
      type: 'Patient Monitoring',
    },
    {
      test: (m) => m.includes('masimo'),
      type: 'Patient Monitoring',
    },
    {
      test: (m, d) =>
        m.includes('ge') &&
        /\b(pdm|patient data module|apex|dash|carescape)\b/i.test(d),
      type: 'Patient Monitoring',
    },
    {
      test: (_, d) => /\bfilac/i.test(d),
      type: 'Diagnostic/Lab',
    },
    {
      test: (m, d) =>
        /hill|hillrom/.test(m) &&
        /\b(century|stretcher|p1440|p3200|p1400|bed)\b/i.test(d),
      type: 'Patient Monitoring',
    },
    {
      test: (m, d) =>
        m.includes('stryker') && /\b(1061|1115|stretcher|cot|transport)\b/i.test(d),
      type: 'Patient Monitoring',
    },
    {
      test: (m) => m.includes('stryker'),
      type: 'Surgical',
    },
    {
      test: (_, d) => /\b(intellivue|mp\d{2}|mx\d|m3002)\b/i.test(d),
      type: 'Patient Monitoring',
    },
    {
      test: (m, d) => m.includes('zoll') && /\bpropaq\b/i.test(d),
      type: 'Patient Monitoring',
    },
    {
      test: (m, d) =>
        m.includes('zoll') ||
        /\b(aed|defibrillator|m series|r series|x series|rseries|emv|emergency medical)\b/i.test(
          d,
        ) ||
        /^m[\s-]?series/i.test(d) ||
        /^rseries$/i.test(d.replace(/\s/g, '')),
      type: 'Defibrillator/Cardiac',
    },
    {
      test: (_, d) =>
        /\b(spectrum|plum|infus|pump|iv\b|iob|syringe)\b/i.test(d) ||
        d.includes('infusion'),
      type: 'Infusion/Pump',
    },
    {
      test: (_, d) =>
        /\b(intellivue|monitor|spot vital|benevision|rad8|mp\d|mx\d|epm|patient data module|pdm|apex pro)\b/i.test(
          d,
        ),
      type: 'Patient Monitoring',
    },
    {
      test: (_, d) => /\b(ventilator|respiratory|v60|v500)\b/i.test(d),
      type: 'Ventilator/Respiratory',
    },
    {
      test: (_, d) =>
        /\b(mri|ct|revolution|imaging|radiology)\b/i.test(d) &&
        !/\bapex\s+pro\b/i.test(d),
      type: 'Imaging/Radiology',
    },
    {
      test: (_, d) => /\b(ultrasound|uc\d|sonosite)\b/i.test(d),
      type: 'Ultrasound',
    },
    {
      test: (_, d) => /\b(endoscope|cv\d|colonoscope|hysteroscope|cystoscope)\b/i.test(d),
      type: 'Endoscopy',
    },
    {
      test: (_, d) => /\b(stretcher|cot|1115|1061)\b/i.test(d),
      type: 'Patient Monitoring',
    },
    {
      test: (_, d) =>
        /\b(bed|century|p3200|p1440|eleganza|hillrom|hill rom)\b/i.test(d) ||
        (mfr.includes('hill') && /\bp\d|century/i.test(d)),
      type: 'Patient Monitoring',
    },
    {
      test: (_, d) => /\b(flowtron|compression|lymphedema)\b/i.test(d),
      type: 'Other',
    },
    {
      test: (m, d) => m.includes('ge') && /\b(apex|pdm|patient data module)\b/i.test(d),
      type: 'Patient Monitoring',
    },
    {
      test: (m, d) =>
        (m.includes('edan') || m.includes('mindray') || m.includes('masimo')) &&
        /\b(im\d|it\d|f9|se\d|rad|epm|benevision)/i.test(d),
      type: 'Patient Monitoring',
    },
    {
      test: (m, d) => m.includes('hospira') || /\bpluma/i.test(d),
      type: 'Infusion/Pump',
    },
    {
      test: (m) => m.includes('arjo'),
      type: 'Other',
    },
    {
      test: (m, d) => m.includes('cogentix') || /\bcst-/i.test(d),
      type: 'Endoscopy',
    },
    {
      test: (m) => m.includes('american diagnostic'),
      type: 'Diagnostic/Lab',
    },
    {
      test: (_, d) =>
        /\b(filac|thermometer|tat\d|spot vital|spot)\b/i.test(d) ||
        /suretemp/i.test(d),
      type: 'Patient Monitoring',
    },
    {
      test: (m) => m.includes('olympus'),
      type: 'Endoscopy',
    },
    {
      test: (m) => m.includes('linet'),
      type: 'Patient Monitoring',
    },
    {
      test: (m) => m.includes('jiangmen'),
      type: 'Infusion/Pump',
    },
    {
      test: (m) => m.includes('thermo'),
      type: 'Diagnostic/Lab',
    },
    {
      test: (m) => m.includes('unico'),
      type: 'Diagnostic/Lab',
    },
    {
      test: (m) => m.includes('biosonic'),
      type: 'Ultrasound',
    },
    {
      test: (m) => m.includes('exergen'),
      type: 'Patient Monitoring',
    },
    {
      test: (m) => m.includes('covidien'),
      type: 'Surgical',
    },
    {
      test: (m) => m.includes('lab corp'),
      type: 'Diagnostic/Lab',
    },
    {
      test: (_, d) => /\b(rapidvac|surgical|electrosurg)\b/i.test(d),
      type: 'Surgical',
    },
    {
      test: (_, d) => /\b(dialysis)\b/i.test(d),
      type: 'Dialysis',
    },
    {
      test: (_, d) => /\b(steril|autoclave)\b/i.test(d),
      type: 'Sterilization',
    },
    {
      test: (_, d) => /\b(lab|642e|diagnostic)\b/i.test(d),
      type: 'Diagnostic/Lab',
    },
    {
      test: (m, d) =>
        m.includes('zoll') || /\b(aed|aedplus|rseries)\b/i.test(d.replace(/\s/g, '')),
      type: 'Defibrillator/Cardiac',
    },
    {
      test: (m, d) =>
        /hill|hillrom/.test(m) || /\b(pcentury|century|k3256)\b/i.test(d),
      type: 'Patient Monitoring',
    },
    {
      test: (m) => m.includes('philips'),
      type: 'Patient Monitoring',
    },
    {
      test: (m) => m.includes('hospira'),
      type: 'Infusion/Pump',
    },
    {
      test: (m) => m.includes('baxter'),
      type: 'Infusion/Pump',
    },
    {
      test: (m) => m.includes('ge'),
      type: 'Patient Monitoring',
    },
  ]

  for (const { test, type } of rules) {
    if (test(mfr, mdl)) return type
  }

  return null
}
