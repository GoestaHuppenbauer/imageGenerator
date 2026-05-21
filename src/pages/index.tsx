import Head from "next/head";
import dynamic from "next/dynamic";

const ImageEnhancer = dynamic(() => import("@/components/ImageEnhancer"), {
  ssr: false,
  loading: () => (
    <p style={{ textAlign: "center", marginTop: "4rem", color: "#5a6776" }}>
      Wird geladen …
    </p>
  ),
});

export default function Home() {
  return (
    <>
      <Head>
        <title>Skalen &amp; Werte aufwerten</title>
        <meta
          name="description"
          content="Abfotografierte oder gescannte Bilder mit Skalen und Werten im Browser entzerren, säubern und scharf neu zeichnen."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <ImageEnhancer />
    </>
  );
}
