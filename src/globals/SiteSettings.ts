import type { GlobalConfig } from 'payload'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: 'Site Ayarları',
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'brandName',
      type: 'text',
      label: 'Marka adı',
      defaultValue: 'Seçkin Çanta',
    },
    {
      name: 'tagline',
      type: 'text',
      label: 'Slogan',
      defaultValue: 'Zamansız deri.',
    },
    {
      name: 'contactEmail',
      type: 'email',
      label: 'İletişim e-posta',
    },
    {
      name: 'contactPhone',
      type: 'text',
      label: 'Telefon',
    },
    {
      name: 'social',
      type: 'group',
      label: 'Sosyal medya',
      fields: [
        { name: 'instagram', type: 'text', label: 'Instagram' },
        { name: 'facebook', type: 'text', label: 'Facebook' },
        { name: 'pinterest', type: 'text', label: 'Pinterest' },
      ],
    },
    {
      name: 'footerLegalLinks',
      type: 'array',
      label: 'Yasal linkler',
      fields: [
        { name: 'label', type: 'text', label: 'Etiket', required: true },
        { name: 'href', type: 'text', label: 'Link', required: true },
      ],
    },
  ],
}
