import { SiteMetadata } from '@/shared/interfaces/sites'

export const siteMetadata: SiteMetadata = {
  name: 'Torrents.csv',
  description: 'Torrents.csv is a self-hostable, open source torrent search engine and database',
  url: 'https://torrents-csv.ml/',
  search: {
    path: '/service/search',
    type: 'json',
    keywordsParams: 'q',
    defaultParams: [
      { key: 'page', value: 1 },
      { key: 'type_', value: 'torrent' }
    ]
  },
  selector: {
    search: {
      rows: { selector: ':self' },
      id: { selector: 'infohash' },
      title: { selector: 'name' },
      url: { text: 'https://torrents-csv.ml/' }, // 该站种子不存在独立介绍页
      link: { selector: 'infohash', filters: [(q:string) => `magnet:?xt=urn:btih:${q}`] },
      time: { selector: 'created_unix' },
      size: { selector: 'size_bytes' },
      seeders: { selector: 'seeders' },
      leechers: { selector: 'leechers' },
      completed: { selector: 'completed' }
    }
  }
}
