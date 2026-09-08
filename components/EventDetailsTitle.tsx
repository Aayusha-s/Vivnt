import Button from "./Button";
import { formatPersonName } from "@/utils/formatPersonName";

type EventDetailsTitleProps = {
    id?: number;
    imgSrc?: string;
    imgAlt: string;
    eventTitle: string;
    eventRating: number;
    attendeeCount:number;
    organizerName: string;
}


const EventDetailsTitle = (
    {
        id,
        imgSrc,
        imgAlt,
        eventTitle,
        eventRating,
        attendeeCount,
        organizerName
    }: EventDetailsTitleProps
) => {
    return (
        <div>
            <div className='flex flex-row gap-10'>
                
                <div className='relative w-[400px] h-[250px]'>
                    <div className='absolute inset-0 bg-brown-normal rotate-3 rounded-xl'></div>

                    <img
                        src={imgSrc}
                        alt={imgAlt}
                        className='absolute inset-0 w-full h-full rounded-xl'
                    />
                </div>

                {/*  and title descriotions*/}
                <div className='flex flex-col gap-4'>
                    <h1 className='text-4xl font-bold mt-5 font-dynapuff'>{eventTitle}</h1>
                    <div className='flex flex-row gap-3 items-center'>
                        <i className="fa-solid fa-star text-yellow-500 text-xl"></i>
                        <p>{`${eventRating} • ${attendeeCount} attendees`}</p>
                    </div>
                    {/* user item */}
                    <div className='flex flex-row items-center'>
                        <div className='border-2 border-brown-normal rounded-[50%] 
                                p-3 flex items-center justify-center'>
                            <i className="fa-solid fa-user text-2xl"></i>
                        </div>
                        <p className='ml-2'>Hosted by <span className='font-semibold font-dynapuff'>{formatPersonName(organizerName)}</span></p>
                    </div>
                    <div>
                        <Button
                            text="Book Now"
                            iconRight={<i className="fa-solid fa-arrow-right"></i>}
                            variant="cta"
                        />
                    </div>
                </div>

            </div>
        </div>
    )
}

export default EventDetailsTitle
