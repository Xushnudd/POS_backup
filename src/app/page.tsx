import Image from "next/image";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import Logo from "@/components/Logo";
import Button from "@/components/Button";
import uz from "@/dictionary/uz.json";
import { faCheck, faMoneyBill1Wave, faSquarePollVertical, faStore, faWarehouse } from "@fortawesome/free-solid-svg-icons";

type NavData = typeof uz.nav;
type BannerData = typeof uz.banner;
type ButtonStyle = 'success' | 'danger' | 'default';
type MyStoreData = typeof uz.mystore;
type ControlInfoData = typeof uz.control_info;
type PriceData = typeof uz.prices;
type TradeData = typeof uz.trade;
type FooterData = typeof uz.footer;

interface NavProps {
  data?: NavData;
}

const Nav = ({ data = uz.nav }: NavProps) => (
  <nav className="w-full sticky top-0 z-50 flex justify-between items-center bg-white">
    <Logo />
    <ul className="text-lg flex gap-5 list-none">
      {data.list.map((el) => (
        <li key={el} className="cursor-pointer">{el}</li>
      ))}
    </ul>
    <Button style="success">{data.button}</Button>
  </nav>
)



interface BannerProps {
  data?: BannerData;
}
const Banner = ({ data = uz.banner }: BannerProps) => (
  <div className="w-full flex items-center gap-20 my-20">
    <div className="w-1/2 flex flex-col gap-10">
      <h1 className="text-4xl font-bold" dangerouslySetInnerHTML={{ __html: data.title }}></h1>
      <p className="text-gray-500 text-sm">{data.caption}</p>
      <div className="flex gap-5">
        {data.buttons.map((btn) => (
          <Button key={btn.name} style={btn.style as ButtonStyle}>{btn.name}</Button>
        ))}
      </div>
    </div>
    <div className="w-1/2 h-max p-6 border border-gray-200 bg-green-100 rounded-2xl">
      <Image
        src={"/img/banner.png"}
        alt="Banner rasmi"
        width={500}
        height={500}
        className="w-full h-80"
      />
    </div>
  </div>
)



interface MyStoreProps {
  data?: MyStoreData;
}

const MyStore = ({ data = uz.mystore }: MyStoreProps) => (
  <div className="my-40 w-full bg-green-100 flex flex-col items-center gap-3 p-10 rounded-2xl border border-gray-200">
    <FontAwesomeIcon icon={faStore} className="w-10 text-green-700" />
    <span className="text-green-700 text-2xl font-bold">{data.title}</span>
    <p className="text-gray-600 text-sm">{data.caption}</p>
  </div>
)



interface ControlInfoProps {
  data?: ControlInfoData;
}

const ControlInfo = ({ data = uz.control_info }: ControlInfoProps) => {
  const icons = [
    faMoneyBill1Wave,
    faWarehouse,
    faSquarePollVertical
  ]
  return (
    <div className="my-40 w-full flex flex-col gap-20">
      <div className="w-full text-center px-20 flex flex-col gap-5">
        <h2 className="text-4xl">{data.title}</h2>
        <p className="text-sm text-gray-600">{data.caption}</p>
      </div>
      <div className="w-full flex justify-around">
        {data.cards.map((card, i: number) => (
          <div key={i} className="w-2/7 border border-gray-200 rounded-xl p-5 flex flex-col gap-3">
            <FontAwesomeIcon icon={icons[i]} className="w-10 text-green-700" />
            <span className="text-xl">{card.title}</span>
            <p>{card.caption}</p>
          </div>
        ))}
      </div>
    </div>
  )
}



interface PriceProps {
  data?: PriceData;
}

const Price = ({ data = uz.prices }: PriceProps) => {
  return (
    <div className="w-full">
      <div className="flex flex-col items-center gap-5">
        <h2 className="text-4xl">{data.title}</h2>
        <p className="text-gray-600">{data.caption}</p>
      </div>
      <div className="my-40 w-full flex justify-around">
        {data.cards.map((card, i:number) => (
          <div key={i} className="border-2 border-gray-200 p-5 rounded-2xl flex flex-col gap-5">
            <div>
              <h3 className="text-3xl font-bold">{card.title}</h3>
              <div className="mt-5">
                <span className="text-5xl">{card.price}</span>
                <span className="text-gray-600">So'm/oy</span>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {card.caption.map((el:string, i:number) => (
                <div key={i} className="flex gap-3">
                  <FontAwesomeIcon icon={faCheck} className="w-3 text-green-700" />
                  <span>{el}</span>
                </div>
              ))}
            </div>
            <Button style={card.button.style as ButtonStyle}>{card.button.title}</Button>
          </div>
        ))}
      </div>
    </div>
  )
}


export default function Home() {
  return (
    <div className="relative px-5 m-auto max-w-7xl min-w-3xl">
      <Nav />
      <Banner />
      <MyStore />
      <ControlInfo />
      <Price />
    </div>
  );
}
