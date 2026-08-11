const getLocalItem = (key: string) => JSON.parse(localStorage.getItem(key) || '[]');
const setLocalItem = (key: string, data: any) => localStorage.setItem(key, JSON.stringify(data));
const nextId = (data: any[]) => Math.max(0, ...data.map((d: any) => d.id || 0)) + 1;
const resetMockWalletsIfNeeded = () => {
  const wallets = getLocalItem('wallets');
  if (!wallets || wallets.length === 0) return;

  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;
  const monthStr = `${year}-${month}`;

  let updated = false;
  const newWallets = wallets.map((w: any) => {
    let walletUpdated = false;
    let daily_limit_rem = w.daily_limit_rem;
    let monthly_limit_rem = w.monthly_limit_rem;
    let last_daily_reset = w.last_daily_reset;
    let last_monthly_reset = w.last_monthly_reset;

    if (w.last_daily_reset !== todayStr) {
      daily_limit_rem = w.daily_limit;
      last_daily_reset = todayStr;
      walletUpdated = true;
    }
    if (w.last_monthly_reset !== monthStr) {
      monthly_limit_rem = w.monthly_limit;
      last_monthly_reset = monthStr;
      walletUpdated = true;
    }

    if (walletUpdated) {
      updated = true;
      return {
        ...w,
        daily_limit_rem,
        monthly_limit_rem,
        last_daily_reset,
        last_monthly_reset
      };
    }
    return w;
  });

  if (updated) {
    setLocalItem('wallets', newWallets);
  }
};

export const setupMockServer = () => {
  const originalFetch = window.fetch;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    let urlStr = typeof input === 'string' ? input : input.toString();
    const method = init?.method || 'GET';
    const body = init?.body ? JSON.parse(init.body as string) : null;
    
    if (!urlStr.includes('/api/')) return originalFetch(input, init);

    resetMockWalletsIfNeeded();

    const jsonResponse = (data: any) => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const errorResponse = (msg: string) => new Response(JSON.stringify({ error: msg }), { status: 400, headers: { 'Content-Type': 'application/json' } });

    // Handle base relative URLs safely
    if (urlStr.startsWith('/')) {
      urlStr = 'http://localhost' + urlStr;
    }
    const urlObj = new URL(urlStr);
    const pathname = urlObj.pathname;
    const searchParams = urlObj.searchParams;

    try {
      // --- Products ---
      if (pathname === '/api/products') {
        let products = getLocalItem('products');
        if (method === 'GET') return jsonResponse(products);
        if (method === 'POST') {
          const newProduct = { ...body, id: nextId(products), quantity: body.quantity || 0 };
          setLocalItem('products', [...products, newProduct]);
          return jsonResponse({ id: newProduct.id });
        }
      }
      if (pathname.match(/^\/api\/products\/\d+$/)) {
        const id = parseInt(pathname.split('/').pop()!);
        let products = getLocalItem('products');
        if (method === 'PUT') {
          const index = products.findIndex((p:any) => p.id === id);
          if (index > -1) products[index] = { ...products[index], ...body, id };
          setLocalItem('products', products);
          return jsonResponse({ success: true });
        }
        if (method === 'DELETE') {
          setLocalItem('products', products.filter((p:any) => p.id !== id));
          let sales = getLocalItem('sales');
          setLocalItem('sales', sales.filter((s:any) => s.product_id !== id));
          return jsonResponse({ success: true });
        }
      }

      // --- Sales ---
      if (pathname.match(/^\/api\/sales$/)) {
        let sales = getLocalItem('sales');
        if (method === 'POST') {
          let products = getLocalItem('products');
          const productIndex = products.findIndex((p:any) => p.id === body.product_id);
          if(productIndex > -1){
              if (products[productIndex].quantity < body.quantity) return errorResponse("الكمية غير كافية");
              products[productIndex].quantity -= body.quantity;
              setLocalItem('products', products);
          }
          const newSale = { ...body, id: nextId(sales), date: new Date().toISOString() };
          setLocalItem('sales', [...sales, newSale]);
          return jsonResponse({ success: true });
        }
      }
      if (pathname === '/api/sales/daily') {
        const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
        const sales = getLocalItem('sales');
        const products = getLocalItem('products');
        const dailySales = sales
            .filter((s:any) => s.date.startsWith(date))
            .map((s:any) => {
                const prod = products.find((p:any) => p.id === s.product_id) || {};
                return { ...s, product_name: prod.name, product_price: prod.price };
            })
            .sort((a:any, b:any) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return jsonResponse(dailySales);
      }
      if (pathname.match(/^\/api\/sales\/\d+$/)) {
        const id = parseInt(pathname.split('/').pop()!);
        let sales = getLocalItem('sales');
        let products = getLocalItem('products');
        const sale = sales.find((s:any) => s.id === id);
        
        if (method === 'DELETE') {
          if(sale) {
            const p_index = products.findIndex((p:any) => p.id === sale.product_id);
            if(p_index > -1){ products[p_index].quantity += sale.quantity; setLocalItem('products', products); }
          }
          setLocalItem('sales', sales.filter((s:any) => s.id !== id));
          return jsonResponse({ success: true });
        }
        if (method === 'PUT') {
          if(sale) {
            const diff = body.quantity - sale.quantity;
            const p_index = products.findIndex((p:any) => p.id === sale.product_id);
            if(p_index > -1) {
                if(products[p_index].quantity < diff) return errorResponse("الكمية غير كافية");
                products[p_index].quantity -= diff;
                setLocalItem('products', products);
            }
            const saleIndex = sales.findIndex((s:any) => s.id === id);
            sales[saleIndex].quantity = body.quantity;
            sales[saleIndex].total_price = body.total_price;
            setLocalItem('sales', sales);
          }
          return jsonResponse({ success: true });
        }
      }
      
      // --- Wallets ---
      if (pathname === '/api/wallets') {
        let wallets = getLocalItem('wallets');
        if (method === 'GET') return jsonResponse(wallets);
        if (method === 'POST') {
          if (wallets.some((w:any) => w.number === body.number)) return errorResponse("Wallet number already exists");
          const d = new Date();
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          const todayStr = `${year}-${month}-${day}`;
          const monthStr = `${year}-${month}`;

          const newWallet = { 
              ...body, id: nextId(wallets), 
              monthly_limit_rem: body.monthly_limit, 
              daily_limit_rem: body.daily_limit,
              balance: body.balance || 0,
              last_daily_reset: todayStr,
              last_monthly_reset: monthStr
          };
          setLocalItem('wallets', [...wallets, newWallet]);
          return jsonResponse({ id: newWallet.id });
        }
      }
      if (pathname.match(/^\/api\/wallets\/\d+$/)) {
        const id = parseInt(pathname.split('/').pop()!);
        let wallets = getLocalItem('wallets');
        if(method === 'PUT'){
            const idx = wallets.findIndex((w:any) => w.id === id);
            if (idx > -1) wallets[idx] = { ...body, id };
            setLocalItem('wallets', wallets);
            return jsonResponse({ success: true });
        }
        if(method === 'DELETE'){
            setLocalItem('wallets', wallets.filter((w:any) => w.id !== id));
            const txs = getLocalItem('wallet_transactions');
            setLocalItem('wallet_transactions', txs.filter((t:any) => t.wallet_id !== id));
            return jsonResponse({ success: true });
        }
      }
      
      if (pathname.match(/^\/api\/wallets\/\d+\/transactions$/)) {
        const id = parseInt(pathname.split('/')[3]);
        const txs = getLocalItem('wallet_transactions').filter((t:any) => t.wallet_id == id);
        txs.sort((a:any, b:any) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return jsonResponse(txs);
      }

      if (pathname.match(/^\/api\/wallets\/\d+\/transaction$/)) {
        const id = parseInt(pathname.split('/')[3]);
        let wallets = getLocalItem('wallets');
        let txs = getLocalItem('wallet_transactions');
        
        const wIdx = wallets.findIndex((w:any) => w.id === id);
        if (wIdx === -1) return errorResponse("Wallet not found");

        const wallet = wallets[wIdx];
        if (body.type === 'withdraw') {
            if (body.amount > (wallet.balance ?? 0)) {
                return errorResponse("المبلغ المراد سحبه أكبر من رصيد المحفظة");
            }
            if (body.amount > (wallet.daily_withdraw_limit_rem ?? 10000)) {
                return errorResponse("المبلغ يتجاوز الحد اليومي للسحب المتبقي");
            }
            if (body.amount > (wallet.monthly_withdraw_limit_rem ?? 50000)) {
                return errorResponse("المبلغ يتجاوز الحد الشهري للسحب المتبقي");
            }
        } else {
            if (body.amount > (wallet.daily_deposit_limit_rem ?? 10000)) {
                return errorResponse("المبلغ يتجاوز الحد اليومي للإيداع المتبقي");
            }
            if (body.amount > (wallet.monthly_deposit_limit_rem ?? 50000)) {
                return errorResponse("المبلغ يتجاوز الحد الشهري للإيداع المتبقي");
            }
        }

        const newTx = { wallet_id: id, type: body.type, amount: body.amount, id: nextId(txs), date: new Date().toISOString() };
        setLocalItem('wallet_transactions', [...txs, newTx]);
        
        if (body.type === 'withdraw') {
            wallets[wIdx].balance -= body.amount;
            wallets[wIdx].monthly_withdraw_limit_rem = (wallets[wIdx].monthly_withdraw_limit_rem ?? 50000) - body.amount;
            wallets[wIdx].daily_withdraw_limit_rem = (wallets[wIdx].daily_withdraw_limit_rem ?? 10000) - body.amount;
        } else {
            wallets[wIdx].balance += body.amount;
            wallets[wIdx].monthly_deposit_limit_rem = (wallets[wIdx].monthly_deposit_limit_rem ?? 50000) - body.amount;
            wallets[wIdx].daily_deposit_limit_rem = (wallets[wIdx].daily_deposit_limit_rem ?? 10000) - body.amount;
        }
        setLocalItem('wallets', wallets);
        return jsonResponse({ success: true });
      }

      if (pathname.match(/^\/api\/wallets\/transactions\/\d+$/)) {
        const txId = parseInt(pathname.split('/').pop()!);
        let txs = getLocalItem('wallet_transactions');
        let wallets = getLocalItem('wallets');
        const txIndex = txs.findIndex((t:any) => t.id === txId);
        const tx = txs[txIndex];
        if(!tx) return errorResponse("Transaction not found");
        const wIdx = wallets.findIndex((w:any) => w.id === tx.wallet_id);

         if (method === 'DELETE') {
          if (wIdx > -1) {
              if (tx.type === 'withdraw') {
                  wallets[wIdx].balance += tx.amount;
                  wallets[wIdx].monthly_withdraw_limit_rem = (wallets[wIdx].monthly_withdraw_limit_rem ?? 50000) + tx.amount;
                  wallets[wIdx].daily_withdraw_limit_rem = (wallets[wIdx].daily_withdraw_limit_rem ?? 10000) + tx.amount;
              } else {
                  wallets[wIdx].balance -= tx.amount;
                  wallets[wIdx].monthly_deposit_limit_rem = (wallets[wIdx].monthly_deposit_limit_rem ?? 50000) + tx.amount;
                  wallets[wIdx].daily_deposit_limit_rem = (wallets[wIdx].daily_deposit_limit_rem ?? 10000) + tx.amount;
              }
              setLocalItem('wallets', wallets);
          }
          txs.splice(txIndex, 1);
          setLocalItem('wallet_transactions', txs);
          return jsonResponse({ success: true });
        }
        
         if (method === 'PUT') {
          const newAmount = body.amount;
          if (wIdx > -1) {
              const wallet = wallets[wIdx];
              // Validate limits and balance with temporary values (reversing the old transaction amount)
              if (tx.type === 'withdraw') {
                  const temp_balance = (wallet.balance ?? 0) + tx.amount;
                  if (newAmount > temp_balance) {
                      return errorResponse("المبلغ المراد سحبه أكبر من رصيد المحفظة");
                  }
                  const temp_daily = (wallet.daily_withdraw_limit_rem ?? 10000) + tx.amount;
                  const temp_monthly = (wallet.monthly_withdraw_limit_rem ?? 50000) + tx.amount;
                  if (newAmount > temp_daily) {
                      return errorResponse("المبلغ يتجاوز الحد اليومي للسحب المتبقي");
                  }
                  if (newAmount > temp_monthly) {
                      return errorResponse("المبلغ يتجاوز الحد الشهري للسحب المتبقي");
                  }
              } else {
                  const temp_daily = (wallet.daily_deposit_limit_rem ?? 10000) + tx.amount;
                  const temp_monthly = (wallet.monthly_deposit_limit_rem ?? 50000) + tx.amount;
                  if (newAmount > temp_daily) {
                      return errorResponse("المبلغ يتجاوز الحد اليومي للإيداع المتبقي");
                  }
                  if (newAmount > temp_monthly) {
                      return errorResponse("المبلغ يتجاوز الحد الشهري للإيداع المتبقي");
                  }
              }

              // 1. Reverse old amount
              if (tx.type === 'withdraw') {
                  wallets[wIdx].balance += tx.amount;
                  wallets[wIdx].monthly_withdraw_limit_rem = (wallets[wIdx].monthly_withdraw_limit_rem ?? 50000) + tx.amount;
                  wallets[wIdx].daily_withdraw_limit_rem = (wallets[wIdx].daily_withdraw_limit_rem ?? 10000) + tx.amount;
              } else {
                  wallets[wIdx].balance -= tx.amount;
                  wallets[wIdx].monthly_deposit_limit_rem = (wallets[wIdx].monthly_deposit_limit_rem ?? 50000) + tx.amount;
                  wallets[wIdx].daily_deposit_limit_rem = (wallets[wIdx].daily_deposit_limit_rem ?? 10000) + tx.amount;
              }

              // 2. Apply new amount
              if (tx.type === 'withdraw') {
                  wallets[wIdx].balance -= newAmount;
                  wallets[wIdx].monthly_withdraw_limit_rem = (wallets[wIdx].monthly_withdraw_limit_rem ?? 50000) - newAmount;
                  wallets[wIdx].daily_withdraw_limit_rem = (wallets[wIdx].daily_withdraw_limit_rem ?? 10000) - newAmount;
              } else {
                  wallets[wIdx].balance += newAmount;
                  wallets[wIdx].monthly_deposit_limit_rem = (wallets[wIdx].monthly_deposit_limit_rem ?? 50000) - newAmount;
                  wallets[wIdx].daily_deposit_limit_rem = (wallets[wIdx].daily_deposit_limit_rem ?? 10000) - newAmount;
              }
              setLocalItem('wallets', wallets);
          }
          txs[txIndex].amount = newAmount;
          setLocalItem('wallet_transactions', txs);
          return jsonResponse({ success: true });
        }
      }

      // --- Debts ---
      if (pathname === '/api/debts') {
        let debts = getLocalItem('debts');
        if (method === 'GET') return jsonResponse(debts);
        if (method === 'POST') {
            const newDebt = { ...body, id: nextId(debts), date: new Date().toISOString() };
            setLocalItem('debts', [...debts, newDebt]);
            return jsonResponse({ id: newDebt.id });
        }
      }
      if (pathname.match(/^\/api\/debts\/\d+$/)) {
        const id = parseInt(pathname.split('/').pop()!);
        let debts = getLocalItem('debts');
        if (method === 'DELETE') {
            setLocalItem('debts', debts.filter((d:any) => d.id !== id));
            return jsonResponse({ success: true });
        }
        if (method === 'PUT') {
            const idx = debts.findIndex((d:any) => d.id === id);
            if(idx > -1) {
                debts[idx].amount_in = body.amount_in;
                debts[idx].amount_out = body.amount_out;
                setLocalItem('debts', debts);
            }
            return jsonResponse({ success: true });
        }
      }

      // --- Expenses ---
      if (pathname === '/api/expenses') {
        let expenses = getLocalItem('expenses');
        if (method === 'GET') return jsonResponse(expenses);
        if (method === 'POST') {
            const newExpense = { ...body, id: nextId(expenses), date: new Date().toISOString() };
            setLocalItem('expenses', [...expenses, newExpense]);
            return jsonResponse({ id: newExpense.id });
        }
      }
      if (pathname.match(/^\/api\/expenses\/\d+$/)) {
        const id = parseInt(pathname.split('/').pop()!);
        let expenses = getLocalItem('expenses');
        if (method === 'DELETE') {
            setLocalItem('expenses', expenses.filter((e:any) => e.id !== id));
            return jsonResponse({ success: true });
        }
      }

      // --- Treasury Log ---
      if (pathname === '/api/treasury') {
        let logs = getLocalItem('treasury_log');
        if (method === 'GET') {
            logs.sort((a:any, b:any) => new Date(b.date).getTime() - new Date(a.date).getTime());
            return jsonResponse(logs);
        }
        if (method === 'POST') {
            const newLog = { ...body, id: nextId(logs), date: new Date().toISOString() };
            setLocalItem('treasury_log', [...logs, newLog]);
            return jsonResponse({ id: newLog.id });
        }
      }
      if (pathname === '/api/treasury/latest') {
        let logs = getLocalItem('treasury_log');
        logs.sort((a:any, b:any) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return jsonResponse(logs.length > 0 ? logs[0] : {});
      }
      if (pathname.match(/^\/api\/treasury\/\d+$/)) {
        const id = parseInt(pathname.split('/').pop()!);
        let logs = getLocalItem('treasury_log');
        if(method === 'DELETE') {
            setLocalItem('treasury_log', logs.filter((l:any) => l.id !== id));
            return jsonResponse({ success: true });
        }
        if(method === 'PUT') {
            const idx = logs.findIndex((l:any) => l.id === id);
            if(idx > -1) logs[idx] = { ...body, id };
            setLocalItem('treasury_log', logs);
            return jsonResponse({ success: true });
        }
      }

      // --- Starting Treasury ---
      if (pathname === '/api/starting-treasury') {
        let starts = getLocalItem('starting_treasury');
        if (method === 'GET') {
            const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
            const filtered = starts.filter((s:any) => s.date.startsWith(date));
            filtered.sort((a:any, b:any) => new Date(b.date).getTime() - new Date(a.date).getTime());
            return jsonResponse(filtered);
        }
        if (method === 'POST') {
            const newStart = { amount: body.amount, id: nextId(starts), date: body.date || new Date().toISOString() };
            setLocalItem('starting_treasury', [...starts, newStart]);
            return jsonResponse({ id: newStart.id });
        }
      }
      if (pathname.match(/^\/api\/starting-treasury\/\d+$/)) {
        const id = parseInt(pathname.split('/').pop()!);
        let starts = getLocalItem('starting_treasury');
        if(method === 'DELETE') {
            setLocalItem('starting_treasury', starts.filter((s:any) => s.id !== id));
            return jsonResponse({ success: true });
        }
        if(method === 'PUT') {
            const idx = starts.findIndex((s:any) => s.id === id);
            if(idx > -1) starts[idx].amount = body.amount;
            setLocalItem('starting_treasury', starts);
            return jsonResponse({ success: true });
        }
      }

      // --- Users ---
      if (pathname === '/api/users') {
          let users = getLocalItem('users');
          if (method === 'GET') return jsonResponse(users);
          if (method === 'POST') {
              const newUser = { id: nextId(users), username: body.username, role: body.role };
              setLocalItem('users', [...users, newUser]);
              return jsonResponse({ id: newUser.id });
          }
      }
      if (pathname.match(/^\/api\/users\/\d+$/)) {
        const id = parseInt(pathname.split('/').pop()!);
        let users = getLocalItem('users');
        if (method === 'DELETE') {
            setLocalItem('users', users.filter((u:any) => u.id !== id));
            return jsonResponse({ success: true });
        }
      }
      if (pathname.match(/^\/api\/users\/\d+\/password$/)) {
        return jsonResponse({ success: true });
      }
      if (pathname === '/api/login') {
        return jsonResponse({ id: 1, username: body?.username, role: 'admin' });
      }

      // --- Reports ---
      if (pathname === '/api/reports/summary') {
        const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
        const sales = getLocalItem('sales').filter((s:any) => s.date.startsWith(date));
        const expenses = getLocalItem('expenses').filter((e:any) => e.date.startsWith(date));
        const debts = getLocalItem('debts').filter((d:any) => d.date.startsWith(date));
        const treasury = getLocalItem('treasury_log').filter((t:any) => t.date.startsWith(date)).sort((a:any, b:any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] || {};
        const wallets = getLocalItem('wallets');
        const starts = getLocalItem('starting_treasury').filter((s:any) => s.date.startsWith(date));

        const totalSales = sales.reduce((sum:number, s:any) => sum + s.total_price, 0);
        const totalExp = expenses.reduce((sum:number, e:any) => sum + e.amount, 0);
        const totalDebts = debts.reduce((sum:number, d:any) => sum + (Number(d.amount_out) - Number(d.amount_in)), 0);
        
        const totalCash = (Number(treasury.cash_200)||0)*200 + (Number(treasury.cash_100)||0)*100 + (Number(treasury.cash_50)||0)*50 + (Number(treasury.cash_20)||0)*20 + (Number(treasury.cash_10)||0)*10 + (Number(treasury.cash_5)||0)*5;
        const totalMachines = (Number(treasury.fawry)||0) + (Number(treasury.neopay)||0) + (Number(treasury.superpay)||0) + (Number(treasury.new_machine1)||0) + (Number(treasury.new_machine2)||0);
        const totalWallets = wallets.reduce((sum:number, w:any) => sum + Number(w.balance), 0);
        const startAmount = starts.reduce((sum:number, s:any) => sum + Number(s.amount), 0);

        const total_treasury = totalCash + totalWallets + totalMachines + totalDebts;
        const net_profit = total_treasury - startAmount;

        return jsonResponse({
          sales: totalSales,
          expenses: totalExp,
          debts: totalDebts,
          total_cash: totalCash,
          total_wallets: totalWallets,
          total_machines: totalMachines,
          total_treasury,
          starting_treasury: startAmount,
          net_profit,
          treasury
        });
      }

      return errorResponse("Mock route not found: " + pathname);
    } catch (e: any) {
      console.error("Mock Server Error:", e);
      return errorResponse(e.message);
    }
  };
};
