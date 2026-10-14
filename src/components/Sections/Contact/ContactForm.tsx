import {FC, memo, useCallback, useState} from 'react';

interface FormData {
  name: string;
  email: string;
  message: string;
}

type Status = 'idle' | 'sending' | 'sent' | 'error';

const ContactForm: FC = memo(() => {
  const [data, setData] = useState<FormData>({name: '', email: '', message: ''});
  const [status, setStatus] = useState<Status>('idle');

  const onChange = useCallback(
    <T extends HTMLInputElement | HTMLTextAreaElement>(event: React.ChangeEvent<T>): void => {
      const {name, value} = event.target;
      setData((current) => ({...current, [name]: value}));
    },
    [],
  );

  const handleSendMessage = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setStatus('sending');
      try {
        const response = await fetch('/api/contact', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(data),
        });
        if (!response.ok) {
          setStatus('error');
          return;
        }
        setStatus('sent');
        setData({name: '', email: '', message: ''});
      } catch {
        setStatus('error');
      }
    },
    [data],
  );

  const inputClasses =
    'bg-neutral-700 border-0 focus:border-0 focus:outline-none focus:ring-1 focus:ring-fuchsia-700 rounded-md placeholder:text-neutral-400 placeholder:text-sm text-neutral-200 text-sm';

  const busy = status === 'sending';

  return (
    <form className="grid min-h-[320px] grid-cols-1 gap-y-4" method="POST" onSubmit={handleSendMessage}>
      <input
        className={inputClasses}
        name="name"
        onChange={onChange}
        placeholder="Your name"
        required
        type="text"
        value={data.name}
      />
      <input
        className={inputClasses}
        name="email"
        onChange={onChange}
        placeholder="Your email"
        required
        type="email"
        value={data.email}
      />
      <textarea
        className={inputClasses}
        maxLength={250}
        name="message"
        onChange={onChange}
        placeholder="Message"
        required
        rows={6}
        value={data.message}
      />
      <button
        aria-label="Submit contact form"
        className="w-max rounded-full border-2 border-fuchsia-600 bg-stone-900 px-4 py-2 text-sm font-medium text-white shadow-md outline-none hover:bg-stone-800 focus:ring-2 focus:ring-fuchsia-700 focus:ring-offset-2 focus:ring-offset-stone-800 disabled:opacity-60"
        disabled={busy}
        type="submit">
        {busy ? 'Sending…' : 'Send Message'}
      </button>
      {status === 'sent' && <p className="text-sm text-fuchsia-400">Thanks, your message has been sent.</p>}
      {status === 'error' && <p className="text-sm text-red-400">Something went wrong. Please try again.</p>}
    </form>
  );
});

ContactForm.displayName = 'ContactForm';
export default ContactForm;
