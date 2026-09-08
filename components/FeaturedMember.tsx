import React from 'react'
import UserAvatar from './UserAvatar';
import Button from './Button';
import { MessageCircle } from 'lucide-react';
import { formatPersonName } from '@/utils/formatPersonName';

type FeaturedMemberProps = {
    name?: string;
    role?: string;
    tags?: string[];
    followersCount?: number;
    followingCount?: number;
    profileUrl?: string;
}

const FeaturedMember = ({
    name,
    role,
    tags,
    followersCount,
    followingCount,
    profileUrl,
}: FeaturedMemberProps) => {
    return (
        <div className='border border-brown-normal rounded-xl p-4 flex flex-col gap-4 hover:shadow-lg'>
            <div className='flex flex-col gap-4 items-center'>
                <UserAvatar nameAbv={name?.split(' ').map(n => n[0]).join('')} name={name} width={20} height={20} href={profileUrl}/>

                <div className='flex flex-col gap-1'>
                    <h3 className='text-text-dark mt-2 font-bold text-2xl text-center'>{formatPersonName(name)}</h3>
                    <p className='text-gray-500 font-medium text-md text-center'>{role}</p>
                    {/* <p className='text-gray-500 font-medium text-md text-center'>{role}</p> */}

                    <div className='flex flex-wrap gap-2 mt-2'>
                        <Button text={tags?.[0]}
                            variant='tag'
                            size='vsm'
                        ></Button>
                        <Button text={tags?.[1]}
                            variant='tag'
                            size='vsm'
                        ></Button>
                        <Button text={tags?.[2]}
                            variant='tag'
                            size='vsm'
                        ></Button>
                    </div>
                </div>
            </div>


            <div className='flex flex-row items-center justify-between'>
                <div className='flex flex-col gap-1 items-center justify-center'>
                    <p className='font-bold text-xl'>{followersCount}</p>
                    <p className='text-md'>Events</p>
                </div>
                <div className='flex flex-col gap-1 items-center justify-center'>
                    <p className='font-bold text-xl'>{followersCount}</p>
                    <p className='text-md'>Followers</p>
                </div>
                <div className='flex flex-col gap-1 items-center justify-center'>
                    <p className='font-bold text-xl'>{followingCount}</p>
                    <p className='text-md'>Following</p>
                </div>
            </div>
            <div className='flex flex-row items-center gap-4'>
                    <Button text='Follow' className='w-full block' />
                    <MessageCircle className='cursor-pointer' />
            </div>
        </div>
    )
}

export default FeaturedMember
