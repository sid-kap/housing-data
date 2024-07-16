import { Html, Head, Main, NextScript } from 'next/document'
import { Favicons } from '../lib/common_elements'

export default function Document(): JSX.Element {
  return (
    <Html lang="en">
      <Head>
        <Favicons />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
