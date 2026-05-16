"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useWeb3Modal } from "@web3modal/wagmi/react";
import { ArrowDownUp, Loader2, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { useToast } from "@/components/Toast";
import { useSubmitTrade } from "@/hooks/useTrade";

// ---------------------------------------------------------------------------
// Token list
// ---------------------------------------------------------------------------

const TOKENS = [
  { value: "USDC",  label: "USDC",  decimals: 6  },
  { value: "USDT",  label: "USDT",  decimals: 6  },
  { value: "DAI",   label: "DAI",   decimals: 18 },
  { value: "WETH",  label: "WETH",  decimals: 18 },
  { value: "ARB",   label: "ARB",   decimals: 18 },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TradeFormProps {
  /** Called when a trade is successfully submitted */
  onSubmitSuccess?: (tradeId: string, orderCID: string, txHash: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TradeForm({ onSubmitSuccess }: TradeFormProps) {
  const { isConnected } = useAccount();
  const { open }        = useWeb3Modal();
  const { toast }       = useToast();
  const submit          = useSubmitTrade();

  const [amount,      setAmount]      = useState("");
  const [tokenIn,     setTokenIn]     = useState("USDC");
  const [tokenOut,    setTokenOut]    = useState("WETH");
  const [slippage,    setSlippage]    = useState("0.5");
  const [errors,      setErrors]      = useState<Record<string, string>>({});

  // ── Validation ────────────────────────────────────────────────────────────
  function validate(): boolean {
    const next: Record<string, string> = {};

    const n = Number(amount);
    if (!amount || isNaN(n) || n <= 0) {
      next.amount = "Enter a valid amount greater than 0";
    }
    if (tokenIn === tokenOut) {
      next.tokenOut = "Input and output tokens must be different";
    }
    const slip = Number(slippage);
    if (isNaN(slip) || slip < 0 || slip > 50) {
      next.slippage = "Slippage must be between 0 and 50%";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  // ── Swap tokens ───────────────────────────────────────────────────────────
  function swapTokens() {
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
    setErrors({});
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isConnected) { open(); return; }
    if (!validate())  return;

    const tokenMeta = TOKENS.find(t => t.value === tokenIn);
    const decimals  = tokenMeta?.decimals ?? 6;
    // Convert human amount to base units
    const inputAmount = BigInt(Math.floor(Number(amount) * 10 ** decimals)).toString();

    try {
      const result = await submit.mutateAsync({
        inputAmount,
        tokenIn,
        tokenOut,
        maxSlippage: Number(slippage),
      });

      toast.success(
        "Trade submitted!",
        `Trade #${result.tradeId} is queued for execution.`
      );

      onSubmitSuccess?.(result.tradeId, result.orderCID, result.txHash);

      // Reset form
      setAmount("");
      setErrors({});
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Submission failed";
      toast.error("Submission failed", msg);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Place Order</CardTitle>
        <CardDescription>
          Orders are encrypted, stored on 0G, and executed inside a TEE
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">

          {/* ── Amount ─────────────────────────────────────────────── */}
          <Input
            label="Amount"
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={e => { setAmount(e.target.value); setErrors(p => ({ ...p, amount: "" })); }}
            min="0"
            step="any"
            error={errors.amount}
            aria-label="Trade input amount"
          />

          {/* ── Token selectors ────────────────────────────────────── */}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Select value={tokenIn} onValueChange={v => { setTokenIn(v); setErrors({}); }}>
                <SelectTrigger label="From" aria-label="Select input token">
                  <SelectValue placeholder="Token In" />
                </SelectTrigger>
                <SelectContent>
                  {TOKENS.map(t => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={swapTokens}
              className="mb-0.5 shrink-0"
              aria-label="Swap token direction"
            >
              <ArrowDownUp className="h-4 w-4" />
            </Button>

            <div className="flex-1">
              <Select value={tokenOut} onValueChange={v => { setTokenOut(v); setErrors(p => ({ ...p, tokenOut: "" })); }}>
                <SelectTrigger label="To" error={errors.tokenOut} aria-label="Select output token">
                  <SelectValue placeholder="Token Out" />
                </SelectTrigger>
                <SelectContent>
                  {TOKENS.map(t => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ── Slippage ───────────────────────────────────────────── */}
          <div>
            <Input
              label="Max Slippage (%)"
              type="number"
              placeholder="0.5"
              value={slippage}
              onChange={e => { setSlippage(e.target.value); setErrors(p => ({ ...p, slippage: "" })); }}
              min="0"
              max="50"
              step="0.1"
              error={errors.slippage}
              hint="Recommended: 0.5% for stable pairs, 1–2% for volatile pairs"
            />
            {/* Quick slippage presets */}
            <div className="mt-2 flex gap-1.5">
              {["0.1", "0.5", "1.0", "2.0"].map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setSlippage(v)}
                  className={`rounded px-2 py-0.5 text-xs transition-colors ${
                    slippage === v
                      ? "bg-blue-600 text-white"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                  }`}
                >
                  {v}%
                </button>
              ))}
            </div>
          </div>

          {/* ── Privacy notice ─────────────────────────────────────── */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-800/40 p-3">
            <p className="text-xs text-zinc-400 leading-relaxed">
              🔒 Your order is <strong className="text-zinc-300">AES-256 encrypted</strong> before
              upload to 0G Storage. Execution happens inside a{" "}
              <strong className="text-zinc-300">Trusted Execution Environment</strong> — details
              are never exposed on-chain before execution.
            </p>
          </div>

          {/* ── Submit ─────────────────────────────────────────────── */}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            loading={submit.isPending}
            leftIcon={<Send className="h-4 w-4" />}
            aria-label={isConnected ? "Submit trade" : "Connect wallet to trade"}
          >
            {!isConnected       ? "Connect Wallet to Trade"  :
             submit.isPending   ? "Submitting…"              :
             "Submit Order"}
          </Button>

          {submit.isError && (
            <p className="text-center text-xs text-red-400" role="alert">
              {submit.error instanceof Error ? submit.error.message : "Submission failed"}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
