import { injected } from "@wagmi/core";
import { createConfig, http } from "wagmi";
import { xLayer, xLayerTestnet } from "./chains";

export const wagmiConfig = createConfig({
  chains: [xLayerTestnet, xLayer],
  connectors: [injected()],
  transports: {
    [xLayer.id]: http(),
    [xLayerTestnet.id]: http(),
  },
  ssr: true,
});
