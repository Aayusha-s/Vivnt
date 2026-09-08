import React from 'react'
import Link from 'next/link'
import Button from './Button'
import { Heart, MessageCircle, SquareArrowOutUpRight, User } from 'lucide-react';
import UserAvatar from './UserAvatar';
import { formatPersonName } from '@/utils/formatPersonName';


type FeedPostProps = {
    nameAbv?: string;
    name?: string;
    userType?: string;
    timeAgo?: string;
    postContent?: string;
    imgUrl?: string;
    profileUrl?: string;
    likes?: number;
    comments?: number;
    shares?: number;
    onFollow?: () => void;


}
const FeedPost = ({
    nameAbv,
    name,
    userType,
    timeAgo,
    postContent,
    imgUrl,
    profileUrl,
    likes = 0,
    comments = 0,
    shares = 0,
    onFollow,
}: FeedPostProps) => {
    return (
        <div className='bg-white rounded-xl border border-gray-200 p-4 hover:shadow-lg transition-shadow '>
            <div className='flex items-start gap-4'>
                <UserAvatar nameAbv={nameAbv} name={name} width={16} height={16} href={profileUrl} />    

                <div className='flex-1'>
                    <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between'>
                        <div >
                            <Link href={profileUrl ?? `/userprofile?username=${encodeURIComponent((name ?? '').toLowerCase().replace(/\s+/g, '-'))}`}>
                                <h3 className='font-semibold text-text-dark hover:text-brown-normal-hover'>{formatPersonName(name)}</h3>
                            </Link>

                            <div className='flex flex-row items-center'>
                                <div className='flex items-center mt-1 gap-1'>
                                    <span className='text-sm text-gray-500'>{userType}</span>
                                    <span className='text-gray-500'>•</span>
                                    <span className='text-sm text-gray-500'>{timeAgo}</span>
                                </div>
                                <div className=''>
                                    <Button text="Follow" variant="secondary" size="md" onClick={onFollow} />
                                </div>
                            </div>
                        </div>

                    </div>

                    <div className='mt-4'>
                        <p className='text-gray-700 leading-relaxed'>
                            {postContent}
                        </p>

                        <img src={imgUrl} alt="Post image" className='w-full rounded-xl' />
                    </div>

                    {/* Post Actions */}
                    <div className='mt-4 flex items-center gap-4 pt-4 border-t border-gray-100'>
                        {/* likes */}
                        <button className='flex items-center gap-2 hover:text-red-500 cursor-pointer'>
                            <Heart />
                            <span className='text-sm font-bold'>{likes}</span>
                        </button>

                        {/* comments */}
                        <button className='flex items-center gap-2 hover:text-blue-500 cursor-pointer'>
                            <MessageCircle />
                            <span className='text-sm font-bold'>{comments}</span>
                        </button>

                        {/* shares */}
                        <button className='flex items-center gap-2 hover:text-green-500 cursor-pointer ml-auto'>
                            <SquareArrowOutUpRight />
                            <span className='text-sm font-bold'>{shares}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default FeedPost
