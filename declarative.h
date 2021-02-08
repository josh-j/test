#pragma once

#include <functional>
#include <tuple>


// helpers for tuple unrolling
template<int ...> struct seq {};
template<int N, int ...S> struct gens : gens<N-1, N-1, S...> {};
template<int ...S> struct gens<0, S...>{ typedef seq<S...> type; };

// invocation helper
template<typename FN, typename P, int ...S>
void call_fn_internal(const FN& fn, const P& params, const seq<S...>)
{
   fn(std::get<S>(params) ...);
}
// call function with arguments stored in std::tuple
template<typename Ret, typename ...Args>
void call_fn(const std::function<Ret(Args...)>& fn,
            const std::tuple<Args...>& params)
{
    call_fn_internal(fn, params, typename gens<sizeof...(Args)>::type());
}

//================================================================================

class DeclarativeInterface {
public:
        virtual ~DeclarativeInterface() {}
  virtual void operator()() = 0;
};

template <class SIGNATURE> class Declarative;
template <class Ret, class... Args>
class Declarative<Ret(Args...)> : public DeclarativeInterface {
public:
  Declarative(const Declarative &) = delete;
  void operator=(const Declarative &) = delete;
  //Declarative() {}
  virtual ~Declarative() {}

  void assign(Ret(*function)(Args...), Args... args) {
    //this->fn = std::bind(std::forward<FUNCTION>(function), args...);
    //fn = std::forward<Ret(Args...)>(function);
    _func = function;
    _params = std::make_tuple(args...);
  }

  Declarative(Ret(*function)(Args...), Args... args) {
    assign(function, args...);
  }
  virtual void operator()() {
    call_fn(_func, _params);
  }

  std::function<Ret(Args...)> _func;
  std::tuple<Args...> _params;
};
