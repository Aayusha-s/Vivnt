"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Button from "@/components/Button";
import ReviewPopup from "@/components/ReviewPopup";
import ModalOverlay from "@/components/ModalOverlay";
import Link from "next/link";
import { formatPersonName } from "@/utils/formatPersonName";

type Review = { _id: string; rating: number; text: string; createdAt: string; user: { _id: string; name: string } };
type Comment = { _id: string; parent?: string; text: string; createdAt: string; likes: string[]; dislikes: string[]; user: { _id: string; name: string } };

export default function EventSocial({ eventId }: { eventId: string }) {
	const { data: session } = useSession();
	const [reviews, setReviews] = useState<Review[]>([]);
	const [comments, setComments] = useState<Comment[]>([]);
	const [summary, setSummary] = useState({ averageRating: 0, reviewCount: 0 });
	const [reviewOpen, setReviewOpen] = useState(false);
	const [text, setText] = useState('');
	const [visible, setVisible] = useState(8);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editingType, setEditingType] = useState<'comment' | 'review' | null>(null);
	const [editingText, setEditingText] = useState('');

	const load = async () => {
		try {
			const [reviewRes, commentRes] = await Promise.all([
				fetch(`/api/events/${eventId}/reviews`).then(r => r.json()),
				fetch(`/api/events/${eventId}/comments`).then(r => r.json())
			]);
			if (reviewRes.success) {
				setReviews(reviewRes.data.items);
				setSummary(reviewRes.data.summary);
			}
			if (commentRes.success) {
				setComments(commentRes.data.items);
			}
		} catch (error) {
			console.error('Failed to load reviews and comments:', error);
		}
	};

	useEffect(() => { load(); }, [eventId]);

	const post = async (parentId?: string) => {
		if (!text.trim()) return;
		try {
			const r = await fetch(`/api/events/${eventId}/comments`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text, parentId })
			});
			if (r.ok) {
				setText('');
				load();
			}
		} catch (error) {
			console.error('Failed to post comment:', error);
		}
	};

	const react = async (id: string, reaction: 'like' | 'dislike') => {
		try {
			await fetch(`/api/comments/${id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ reaction })
			});
			load();
		} catch (error) {
			console.error('Failed to react:', error);
		}
	};

	const remove = async (id: string, kind: 'comment' | 'review') => {
		try {
			await fetch(`/api/${kind === 'comment' ? 'comments' : 'reviews'}/${id}`, { method: 'DELETE' });
			load();
		} catch (error) {
			console.error('Failed to delete:', error);
		}
	};

	const startEdit = (id: string, type: 'comment' | 'review', currentText: string) => {
		setEditingId(id);
		setEditingType(type);
		setEditingText(currentText);
	};

	const cancelEdit = () => {
		setEditingId(null);
		setEditingType(null);
		setEditingText('');
	};

	const saveEdit = async () => {
		if (!editingText.trim()) return;
		try {
			if (editingType === 'comment') {
				await fetch(`/api/comments/${editingId}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ text: editingText.trim() })
				});
			} else if (editingType === 'review') {
				const review = reviews.find(r => r._id === editingId);
				if (!review) return;
				await fetch(`/api/events/${eventId}/reviews`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ rating: review.rating, text: editingText.trim() })
				});
			}
			cancelEdit();
			load();
		} catch (error) {
			console.error('Failed to edit:', error);
		}
	};

	const roots = comments.filter(c => !c.parent);
	const userLink = (userId: string) => `/userprofile?userId=${userId}`;

	return (
		<section className='mt-10 md:mt-16 border-2 border-brown-normal rounded-xl p-4 md:p-6'>
			<div className='flex justify-between items-center mb-4'>
				<h2 className='font-dynapuff font-bold text-xl'>Reviews & Comments</h2>
				<p><i className='fa-solid fa-star text-yellow-500 mr-1' />{summary.averageRating.toFixed(1)} ({summary.reviewCount})</p>
			</div>
			{session && <Button text='Write Review' variant='cta' size='sm' onClick={() => setReviewOpen(true)} />}

			<ReviewPopup
				isOpen={reviewOpen}
				onclose={() => setReviewOpen(false)}
				onSubmit={async (rating, reviewText) => {
					try {
						const finalText = reviewText.trim();
						if (!finalText) throw new Error('Please write a review before submitting.');
						const response = await fetch(`/api/events/${eventId}/reviews`, {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ rating, text: finalText })
						});
						const result = await response.json();
						if (!response.ok) throw new Error(result.error?.message || 'Unable to submit review.');
						setReviewOpen(false);
						load();
					} catch (error) {
						console.error('Failed to submit review:', error);
					}
				}}
			/>

			{editingId && editingType && (
                <ModalOverlay isOpen onClose={cancelEdit} ariaLabel={`Edit ${editingType}`}>
					<div className='bg-white rounded-xl p-6 max-w-md w-full' onMouseDown={(e) => e.stopPropagation()}>
						<h3 className='text-lg font-semibold mb-4 text-text-dark'>Edit {editingType === 'review' ? 'Review' : 'Comment'}</h3>
						<textarea
							value={editingText}
							onChange={(e) => setEditingText(e.target.value)}
							className='w-full rounded-xl border border-border bg-surface px-3 py-3 mb-4 text-text-dark focus-ring'
							rows={4}
							placeholder={`Edit your ${editingType}...`}
						/>
						<div className='flex gap-2 justify-end'>
							<Button text='Cancel' variant='secondary' size='md' onClick={cancelEdit} />
							<Button text='Save' variant='cta' size='md' onClick={saveEdit} />
						</div>
					</div>
				</ModalOverlay>
			)}

			<div className='mt-4 space-y-3'>
				{reviews.map(review => (
					<div key={review._id} className='border-b border-brown-normal/30 pb-3'>
						<div className='flex justify-between items-start'>
							<Link href={userLink(review.user._id)} className='font-semibold text-brown-normal hover:text-brown-dark transition-colors'>
								{formatPersonName(review.user.name)}
							</Link>
							{session?.user?.id === review.user._id && (
								<div className='flex gap-2'>
									<button onClick={() => startEdit(review._id, 'review', review.text)} className='text-xs text-blue-600 hover:text-blue-800'>Edit</button>
									<button onClick={() => remove(review._id, 'review')} className='text-xs text-red-600 hover:text-red-800'>Delete</button>
								</div>
							)}
						</div>
						<p className='mt-1'>{'★'.repeat(review.rating)}</p>
						<p>{review.text}</p>
						<p className='text-sm text-text-dark/70'>{new Date(review.createdAt).toLocaleString()}</p>
					</div>
				))}
			</div>

			<div className='mt-6'>
				<h3 className='font-semibold mb-2'>Comments</h3>
				{session && (
					<div className='flex gap-2 mb-4'>
						<input value={text} onChange={e => setText(e.target.value)} className='border border-brown-normal rounded-lg px-3 py-2 grow' placeholder='Add a comment' />
						<Button text='Post' variant='cta' size='sm' onClick={() => post()} />
					</div>
				)}
				<div className='mt-4 space-y-3'>
					{roots.slice(0, visible).map(comment => (
						<div key={comment._id} className='border-b border-brown-normal/30 pb-3'>
							<div className='flex justify-between items-start'>
								<Link href={userLink(comment.user._id)} className='font-semibold text-brown-normal hover:text-brown-dark transition-colors'>
									{comment.user.name}
								</Link>
								{session?.user?.id === comment.user._id && (
									<div className='flex gap-2'>
										<button onClick={() => startEdit(comment._id, 'comment', comment.text)} className='text-xs text-blue-600 hover:text-blue-800'>Edit</button>
										<button onClick={() => remove(comment._id, 'comment')} className='text-xs text-red-600 hover:text-red-800'>Delete</button>
									</div>
								)}
							</div>
							<p>{comment.text}</p>
							<p className='text-sm text-text-dark/70'>{new Date(comment.createdAt).toLocaleString()}</p>
							<div className='flex gap-2'>
								<Button text={`Like ${comment.likes.length}`} variant='secondary' size='sm' onClick={() => react(comment._id, 'like')} />
								<Button text={`Dislike ${comment.dislikes.length}`} variant='secondary' size='sm' onClick={() => react(comment._id, 'dislike')} />
							</div>
							{comments.filter(reply => reply.parent === comment._id).map(reply => (
								<div className='ml-6 mt-3' key={reply._id}>
									<Link href={userLink(reply.user._id)} className='font-semibold text-brown-normal hover:text-brown-dark text-sm'>
										{reply.user.name}
									</Link>
									<p>{reply.text}</p>
								</div>
							))}
							{session && (
								<Button text='Reply' variant='secondary' size='sm' onClick={() => {
									const reply = window.prompt('Reply');
									if (reply) fetch(`/api/events/${eventId}/comments`, {
										method: 'POST',
										headers: { 'Content-Type': 'application/json' },
										body: JSON.stringify({ text: reply, parentId: comment._id })
									}).then(() => load());
								}} />
							)}
						</div>
					))}
				</div>
				{visible < roots.length && (
					<Button text='Load More' variant='secondary' size='sm' onClick={() => setVisible(v => v + 8)} />
				)}
			</div>
		</section>
	);
}
