import { Button } from "@/components/ui/button";
import { formatMoney, type Sale } from "@/lib/api/sales";

export function SaleReceipt({ sale }: { sale: Sale }) {
  return (
    <article className="sale-receipt w-full rounded-xl border border-zinc-300 bg-white p-6 text-black">
      <header className="border-b border-zinc-300 pb-3 text-center">
        <p className="text-sm">{sale.outletName}</p>
        <p className="text-xs">{sale.outletCode}</p>
        <h2 className="mt-2 text-lg font-semibold">Receipt {sale.receiptNo}</h2>
        <p className="text-xs">{new Date(sale.createdAt).toLocaleString()}</p>
      </header>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-zinc-600">Table</dt>
          <dd>{sale.tableNo ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-600">Order</dt>
          <dd>{sale.orderStatus}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-600">Payment</dt>
          <dd>{sale.paymentStatus}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-600">Total</dt>
          <dd className="font-semibold">{formatMoney(sale.total)}</dd>
        </div>
        <Detail label="Sale ID" value={sale.id} />
        <Detail label="Company ID" value={sale.companyId} />
        <Detail label="Outlet ID" value={sale.outletId} />
        <Detail label="Idempotency key" value={sale.idempotencyKey ?? "—"} />
      </dl>
      <table className="mt-5 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-300 text-xs text-zinc-600">
            <th className="py-1 font-medium">Item</th>
            <th className="py-1 text-right font-medium">Qty</th>
            <th className="py-1 text-right font-medium">Unit price</th>
            <th className="py-1 text-right font-medium">Line total</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((item) => (
            <tr key={item.id} className="border-b border-zinc-200">
              <td className="py-2">{item.menuItemName}</td>
              <td className="py-2 text-right">{item.quantity}</td>
              <td className="py-2 text-right">{formatMoney(item.unitPrice)}</td>
              <td className="py-2 text-right">{formatMoney(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-zinc-600">{label}</dt>
      <dd className="break-all">{value}</dd>
    </div>
  );
}

export function PrintReceiptButton() {
  return (
    <Button type="button" onClick={() => window.print()}>
      Print
    </Button>
  );
}
