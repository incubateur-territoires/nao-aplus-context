"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { ContactMessageDirection } from "@/generated/prisma/enums";
import { formatToLongDate } from "@/utils/format";

const TIME_ZONE = "Europe/Paris";

interface ContactThreadProps {
  contactId: string;
}

export function ContactThread({ contactId }: ContactThreadProps) {
  const trpc = useTRPC();
  const { data: contact } = useQuery(
    trpc.crm.getContactById.queryOptions({ id: contactId }),
  );

  const messages = contact?.messages ?? [];

  return (
    <section className="p-4 md:p-20 bg-white mt-8">
      <h2>Échanges</h2>
      {messages.length === 0 ? (
        <p className="mt-6">Aucun échange avec ce contact pour le moment.</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-6 list-none p-0">
          {messages.map((message) => {
            // Le fond et l'alignement distinguent les deux sens, mais la couleur
            // seule n'est pas accessible : le libellé porte la même information.
            const isOutbound =
              message.direction === ContactMessageDirection.OUTBOUND;
            const author = isOutbound
              ? `Envoyé par ${
                  message.sentBy
                    ? `${message.sentBy.firstName} ${message.sentBy.lastName}`
                    : "Administration+"
                }`
              : "Reçu du contact";

            return (
              <li
                key={message.id}
                className={`p-4 w-full md:w-4/5 ${
                  isOutbound
                    ? "bg-blue-background md:self-end"
                    : "bg-[#F6F6F6] md:self-start"
                }`}
              >
                <p className="text-sm text-[#3A3A3A]">{author}</p>
                <p className="text-sm text-[#3A3A3A]">
                  {formatToLongDate(message.createdAt, TIME_ZONE)}
                </p>
                <p className="font-bold mt-2">{message.subject}</p>
                <p className="mt-2 whitespace-pre-line break-words">
                  {message.textContent}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
