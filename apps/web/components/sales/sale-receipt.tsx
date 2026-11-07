import { Button } from "@/components/ui/button";
import { formatMoney, type Sale } from "@/lib/api/sales";

export function SaleReceipt({ sale }: { sale: Sale }) {
  return (
    <article className="sale-receipt w-full max-w-sm rounded-xl border border-zinc-300 bg-white p-6 text-black">
      <header className="border-b border-zinc-300 pb-3 text-center">
        <p className="text-sm">{sale.outletName}</p>
        <p className="text-xs">{sale.outletCode}</p>
        <h2 className="mt-2 text-lg font-semibold">Receipt {sale.receiptNo}</h2>
        <p className="text-xs">{new Date(sale.createdAt).toLocaleString()}</p>
      </header>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
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
      </dl>
      <table className="mt-4 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-300 text-xs text-zinc-600">
            <th className="py-1 font-medium">Item</th>
            <th className="py-1 font-medium">Qty</th>
            <th className="py-1 text-right font-medium">Line</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((item) => (
            <tr key={item.id} className="border-b border-zinc-200">
              <td className="py-1">
                {item.menuItemName}
                <span className="block text-xs text-zinc-600">{formatMoney(item.unitPrice)}</span>
              </td>
              <td className="py-1">{item.quantity}</td>
              <td className="py-1 text-right">{formatMoney(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}

export function PrintReceiptButton() {
  return (
    <Button type="button" onClick={() => window.print()}>
      Print
    </Button>
  );
}
